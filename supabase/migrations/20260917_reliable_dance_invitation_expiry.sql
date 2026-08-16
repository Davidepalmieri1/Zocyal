begin;

alter table public.dance_invitations
  alter column expires_at set default (now() + interval '30 minutes');

-- Preserve pending invitations that are still inside the new validity window.
update public.dance_invitations
set expires_at = created_at + interval '30 minutes'
where status = 'pending'
  and expires_at < created_at + interval '30 minutes';

create or replace function public.get_dance_lobby(p_event_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_code text := lower(trim(p_event_code));
  v_mine uuid;
  v_completed_test boolean;
begin
  select participant.id, participant.completed_test
  into v_mine, v_completed_test
  from participants participant
  join events event on event.code = participant.event_code
  where participant.auth_user_id = auth.uid()
    and participant.event_code = v_event_code
    and event.experience_mode = 'caribbean';

  if v_mine is null then
    raise exception 'Caribbean participant not found';
  end if;

  update dance_invitations
  set status = 'expired', responded_at = now()
  where event_code = v_event_code
    and status = 'pending'
    and expires_at <= now();

  return jsonb_build_object(
    'completed_test', coalesce(v_completed_test, false),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participant_id', profile.participant_id,
        'role', profile.role,
        'skills', profile.skills,
        'available', profile.available,
        'participant', jsonb_build_object(
          'nickname', participant.nickname,
          'avatar_url', participant.avatar_url
        )
      ) order by participant.nickname)
      from participant_dance_profiles profile
      join participants participant on participant.id = profile.participant_id
      where participant.event_code = v_event_code
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'sender_id', invitation.sender_id,
        'receiver_id', invitation.receiver_id,
        'style', invitation.style,
        'status', invitation.status,
        'created_at', invitation.created_at,
        'expires_at', invitation.expires_at,
        'sender', jsonb_build_object('nickname', sender.nickname),
        'receiver', jsonb_build_object('nickname', receiver.nickname)
      ) order by invitation.created_at desc)
      from dance_invitations invitation
      join participants sender on sender.id = invitation.sender_id
      join participants receiver on receiver.id = invitation.receiver_id
      where invitation.event_code = v_event_code
        and v_mine in (invitation.sender_id, invitation.receiver_id)
    ), '[]'::jsonb)
  );
end;
$$;

commit;
