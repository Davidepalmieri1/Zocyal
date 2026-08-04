begin;

create or replace function public.delete_own_participant(
  p_event_code text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participant_id uuid;
  v_avatar_url text;
begin
  if auth.uid() is null then
    raise exception 'Participant authentication required'
      using errcode = '28000';
  end if;

  if upper(trim(coalesce(p_confirmation, ''))) <> 'ELIMINA' then
    raise exception 'Invalid deletion confirmation'
      using errcode = '22023';
  end if;

  select participant.id, participant.avatar_url
  into v_participant_id, v_avatar_url
  from public.participants participant
  where participant.event_code = v_event
    and participant.auth_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Participant not found for this event'
      using errcode = 'P0002';
  end if;

  delete from public.reward_redemptions
  where participant_id = v_participant_id;

  delete from public.participant_mission_completions
  where participant_id = v_participant_id;

  delete from public.reports
  where reported_by = v_participant_id
     or reported_participant = v_participant_id;

  delete from public.participant_blocks
  where blocked_by = v_participant_id
     or blocked_participant = v_participant_id;

  delete from public.likes
  where from_participant = v_participant_id
     or to_participant = v_participant_id;

  delete from public.matches
  where user_one = v_participant_id
     or user_two = v_participant_id;

  delete from public.participants
  where id = v_participant_id
    and event_code = v_event
    and auth_user_id = auth.uid();

  return jsonb_build_object(
    'deleted', true,
    'avatar_url', v_avatar_url
  );
end;
$$;

revoke all on function public.delete_own_participant(text, text)
from public, anon, authenticated;

grant execute on function public.delete_own_participant(text, text)
to authenticated;

commit;
