-- Return the notification center state in one round trip. This replaces the
-- fan-out of independent browser queries that multiplied with every attendee.

create or replace function public.get_notification_center_snapshot(
  p_event_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participant uuid := public.current_participant_for_event(v_event);
begin
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'matches', coalesce((
      select jsonb_agg(to_jsonb(connection_row) order by connection_row.created_at desc)
      from (
        select connection.id, connection.user_one, connection.user_two, connection.created_at
        from public.matches connection
        where v_participant in (connection.user_one, connection.user_two)
          and connection.status <> 'blocked'
      ) connection_row
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(message_row) order by message_row.created_at desc)
      from (
        select message.id, message.match_id, message.message, message.created_at
        from public.messages message
        where message.receiver_id = v_participant
          and message.read_at is null
        order by message.created_at desc
        limit 20
      ) message_row
    ), '[]'::jsonb),
    'table_invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'table', jsonb_build_object('name', game_table.name, 'game', game_table.game)
      ) order by invitation.invited_at desc)
      from public.game_table_invitations invitation
      join public.game_tables game_table on game_table.id = invitation.table_id
      where invitation.participant_id = v_participant
        and invitation.status = 'pending'
        and game_table.event_code = v_event
    ), '[]'::jsonb),
    'interests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', interest.id,
        'from_participant', interest.from_participant,
        'to_participant', interest.to_participant,
        'sender_nickname', sender.nickname
      ))
      from public.likes interest
      join public.participants sender on sender.id = interest.from_participant
      where interest.to_participant = v_participant
        and sender.event_code = v_event
    ), '[]'::jsonb),
    'mission_completions', coalesce((
      select jsonb_agg(to_jsonb(completion_row) order by completion_row.completed_at desc)
      from (
        select
          completion.id,
          completion.points_awarded,
          completion.completed_at,
          jsonb_build_object('title', mission.title, 'event_code', mission.event_code) as mission
        from public.participant_mission_completions completion
        join public.missions mission on mission.id = completion.mission_id
        where completion.participant_id = v_participant
          and mission.event_code = v_event
        order by completion.completed_at desc
        limit 100
      ) completion_row
    ), '[]'::jsonb),
    'reads', coalesce((
      select jsonb_agg(jsonb_build_object('notification_id', receipt.notification_id))
      from public.participant_notification_reads receipt
      where receipt.participant_id = v_participant
    ), '[]'::jsonb),
    'drink_offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', offer.id,
        'match_id', offer.match_id,
        'sender_id', offer.sender_id,
        'status', offer.status,
        'sender_nickname', sender.nickname
      ) order by offer.created_at desc)
      from public.drink_offers offer
      join public.participants sender on sender.id = offer.sender_id
      where offer.receiver_id = v_participant
        and offer.status = 'pending'
        and offer.event_code = v_event
    ), '[]'::jsonb),
    'dance_invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'sender_id', invitation.sender_id,
        'receiver_id', invitation.receiver_id,
        'status', invitation.status,
        'sender', jsonb_build_object('nickname', sender.nickname)
      ) order by invitation.created_at desc)
      from public.dance_invitations invitation
      join public.participants sender on sender.id = invitation.sender_id
      where invitation.event_code = v_event
        and v_participant in (invitation.sender_id, invitation.receiver_id)
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', reward.id,
        'name', reward.name,
        'redeemed', true,
        'redemption_status', redemption.status
      ) order by redemption.redeemed_at desc)
      from public.reward_redemptions redemption
      join public.rewards reward on reward.id = redemption.reward_id
      where redemption.participant_id = v_participant
        and redemption.status = 'redeemed'
        and reward.event_code = v_event
        and reward.active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_notification_center_snapshot(text)
from public, anon;

grant execute on function public.get_notification_center_snapshot(text)
to authenticated;
