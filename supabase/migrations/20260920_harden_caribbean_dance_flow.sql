begin;

create index if not exists dance_invites_sender_status
  on public.dance_invitations(sender_id, status, created_at desc);

create or replace function public.send_dance_invitation(
  p_event_code text,
  p_receiver_id uuid,
  p_style text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_code text := lower(trim(p_event_code));
  v_sender uuid;
  v_id uuid;
  v_sender_profile public.participant_dance_profiles%rowtype;
  v_receiver_profile public.participant_dance_profiles%rowtype;
begin
  select participant.id into v_sender
  from public.participants participant
  join public.events event on event.code = participant.event_code
  where participant.auth_user_id = auth.uid()
    and participant.event_code = v_event_code
    and event.experience_mode = 'caribbean';

  if v_sender is null or p_receiver_id is null or v_sender = p_receiver_id then
    raise exception 'Caribbean participant not found';
  end if;

  if p_style not in (
    'salsa_cubana', 'salsa_portoricana', 'bachata', 'bachata_sensual',
    'merengue', 'kizomba', 'balli_di_gruppo'
  ) then
    raise exception 'Invalid dance skill';
  end if;

  -- Serialize invitations involving either participant. This prevents two
  -- concurrent requests from making the same dancer busy twice.
  perform pg_advisory_xact_lock(hashtextextended(
    'dance-participant:' || least(v_sender::text, p_receiver_id::text), 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'dance-participant:' || greatest(v_sender::text, p_receiver_id::text), 0
  ));

  select profile.* into v_sender_profile
  from public.participant_dance_profiles profile
  where profile.participant_id = v_sender
  for update;

  select profile.* into v_receiver_profile
  from public.participant_dance_profiles profile
  join public.participants participant on participant.id = profile.participant_id
  where profile.participant_id = p_receiver_id
    and participant.event_code = v_event_code
  for update;

  if v_sender_profile.participant_id is null
     or v_receiver_profile.participant_id is null then
    raise exception 'Dance profile required';
  end if;

  if not v_sender_profile.available or not v_receiver_profile.available then
    raise exception 'Dancer unavailable';
  end if;

  if not (v_sender_profile.skills ? p_style and v_receiver_profile.skills ? p_style) then
    raise exception 'Dance style not shared';
  end if;

  if not (
    v_sender_profile.role = 'both'
    or v_receiver_profile.role = 'both'
    or v_sender_profile.role <> v_receiver_profile.role
  ) then
    raise exception 'Dance roles not compatible';
  end if;

  update public.dance_invitations
  set status = 'expired', responded_at = now()
  where event_code = v_event_code
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1
    from public.dance_invitations invitation
    where invitation.event_code = v_event_code
      and invitation.status = 'pending'
      and (
        invitation.sender_id in (v_sender, p_receiver_id)
        or invitation.receiver_id in (v_sender, p_receiver_id)
      )
  ) then
    raise exception 'Dancer already invited';
  end if;

  insert into public.dance_invitations (
    event_code, sender_id, receiver_id, style, message
  ) values (
    v_event_code,
    v_sender,
    p_receiver_id,
    p_style,
    nullif(left(trim(p_message), 120), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.respond_dance_invitation(
  p_invitation_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_invite public.dance_invitations%rowtype;
  v_sender_available boolean;
  v_receiver_available boolean;
begin
  if p_response not in ('accepted', 'declined', 'later') then
    raise exception 'Invalid response';
  end if;

  select invitation.* into v_invite
  from public.dance_invitations invitation
  join public.participants receiver on receiver.id = invitation.receiver_id
  where invitation.id = p_invitation_id
    and receiver.auth_user_id = auth.uid()
  for update of invitation;

  if v_invite.id is null
     or v_invite.status <> 'pending'
     or v_invite.expires_at <= now() then
    raise exception 'Invitation unavailable';
  end if;

  if p_response = 'accepted' then
    perform pg_advisory_xact_lock(hashtextextended(
      'dance-participant:' || least(v_invite.sender_id::text, v_invite.receiver_id::text), 0
    ));
    perform pg_advisory_xact_lock(hashtextextended(
      'dance-participant:' || greatest(v_invite.sender_id::text, v_invite.receiver_id::text), 0
    ));

    select available into v_sender_available
    from public.participant_dance_profiles
    where participant_id = v_invite.sender_id
    for update;
    select available into v_receiver_available
    from public.participant_dance_profiles
    where participant_id = v_invite.receiver_id
    for update;

    if not coalesce(v_sender_available, false)
       or not coalesce(v_receiver_available, false) then
      raise exception 'Dancer unavailable';
    end if;

    update public.dance_invitations
    set status = 'cancelled', responded_at = now()
    where event_code = v_invite.event_code
      and id <> v_invite.id
      and status = 'pending'
      and (
        sender_id in (v_invite.sender_id, v_invite.receiver_id)
        or receiver_id in (v_invite.sender_id, v_invite.receiver_id)
      );

    update public.participant_dance_profiles
    set available = false, updated_at = now()
    where participant_id in (v_invite.sender_id, v_invite.receiver_id);
  end if;

  update public.dance_invitations
  set status = p_response, responded_at = now()
  where id = v_invite.id;
end;
$$;

create or replace function public.cancel_dance_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  update public.dance_invitations invitation
  set status = 'cancelled', responded_at = now()
  from public.participants sender
  where invitation.id = p_invitation_id
    and sender.id = invitation.sender_id
    and sender.auth_user_id = auth.uid()
    and invitation.status = 'pending';

  if not found then
    raise exception 'Invitation unavailable';
  end if;
end;
$$;

create or replace function public.set_dance_availability(
  p_event_code text,
  p_available boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_participant uuid;
begin
  select participant.id into v_participant
  from public.participants participant
  join public.events event on event.code = participant.event_code
  where participant.auth_user_id = auth.uid()
    and participant.event_code = lower(trim(p_event_code))
    and event.experience_mode = 'caribbean';

  if v_participant is null then
    raise exception 'Caribbean participant not found';
  end if;

  update public.participant_dance_profiles
  set available = p_available, updated_at = now()
  where participant_id = v_participant;

  if not found then
    raise exception 'Dance profile required';
  end if;
end;
$$;

create or replace function public.get_dance_lobby(p_event_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_code text := lower(trim(p_event_code));
  v_mine uuid;
  v_completed_test boolean;
begin
  select participant.id, participant.completed_test
  into v_mine, v_completed_test
  from public.participants participant
  join public.events event on event.code = participant.event_code
  where participant.auth_user_id = auth.uid()
    and participant.event_code = v_event_code
    and event.experience_mode = 'caribbean';

  if v_mine is null then
    raise exception 'Caribbean participant not found';
  end if;

  update public.dance_invitations
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
      ) order by profile.available desc, participant.nickname)
      from public.participant_dance_profiles profile
      join public.participants participant on participant.id = profile.participant_id
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
      from (
        select own_invitation.*
        from public.dance_invitations own_invitation
        where own_invitation.event_code = v_event_code
          and v_mine in (own_invitation.sender_id, own_invitation.receiver_id)
        order by own_invitation.created_at desc
        limit 50
      ) invitation
      join public.participants sender on sender.id = invitation.sender_id
      join public.participants receiver on receiver.id = invitation.receiver_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.send_dance_invitation(text, uuid, text, text) from public;
revoke all on function public.respond_dance_invitation(uuid, text) from public;
revoke all on function public.cancel_dance_invitation(uuid) from public;
revoke all on function public.set_dance_availability(text, boolean) from public;
revoke all on function public.get_dance_lobby(text) from public;
grant execute on function public.send_dance_invitation(text, uuid, text, text) to authenticated;
grant execute on function public.respond_dance_invitation(uuid, text) to authenticated;
grant execute on function public.cancel_dance_invitation(uuid) to authenticated;
grant execute on function public.set_dance_availability(text, boolean) to authenticated;
grant execute on function public.get_dance_lobby(text) to authenticated;

commit;
