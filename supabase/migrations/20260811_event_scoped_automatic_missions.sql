begin;

create or replace function public.complete_automatic_mission(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid;
  v_mission public.missions;
  v_required integer;
  v_observed integer := 0;
  v_completion_id uuid;
  v_inserted boolean := false;
begin
  select * into v_mission
  from public.missions mission
  where mission.id = p_mission_id
  for update;

  if v_mission.id is null
     or not v_mission.active
     or v_mission.verification_mode <> 'automatic'
     or (v_mission.starts_at is not null and v_mission.starts_at > now())
     or (v_mission.ends_at is not null and v_mission.ends_at <= now()) then
    raise exception 'Mission unavailable';
  end if;

  v_participant := public.current_participant_for_event(v_mission.event_code);
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  begin
    v_required := coalesce(
      (v_mission.verification_config ->> 'minimum')::integer,
      1
    );
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid mission verification configuration';
  end;

  if v_required < 1 then
    raise exception 'Invalid mission verification configuration';
  end if;

  case v_mission.verification_key
    when 'profile_completed' then
      select case when coalesce(participant.completed_test, false) then 1 else 0 end
      into v_observed
      from public.participants participant
      where participant.id = v_participant;
    when 'questionnaire_completed' then
      select count(*)::integer into v_observed
      from public.answers answer
      where answer.participant_id = v_participant;
    when 'interests_sent' then
      select count(*)::integer into v_observed
      from public.likes interest
      where interest.from_participant = v_participant;
    when 'matches_created' then
      select count(*)::integer into v_observed
      from public.matches matched
      where matched.user_one = v_participant or matched.user_two = v_participant;
    when 'messages_sent' then
      select count(*)::integer into v_observed
      from public.messages message
      where message.sender_id = v_participant;
    else
      raise exception 'Unsupported automatic verification';
  end case;

  if coalesce(v_observed, 0) < v_required then
    raise exception 'Mission requirements not met';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('mission-rewards:' || v_mission.event_code, 0)
  );

  insert into public.participant_mission_completions (
    participant_id, mission_id, points_awarded, verification_mode,
    verification_evidence
  ) values (
    v_participant, v_mission.id, v_mission.points, 'automatic',
    jsonb_build_object(
      'verification_key', v_mission.verification_key,
      'required', v_required,
      'observed', v_observed,
      'verified_at', now()
    )
  )
  on conflict (participant_id, mission_id) do nothing
  returning id into v_completion_id;

  v_inserted := v_completion_id is not null;

  if not v_inserted then
    select completion.id into v_completion_id
    from public.participant_mission_completions completion
    where completion.participant_id = v_participant
      and completion.mission_id = v_mission.id;
  end if;

  return jsonb_build_object(
    'completion_id', v_completion_id,
    'awarded', v_inserted,
    'points_available', public.mr_points_available(v_participant)
  );
end;
$$;

revoke all on function public.complete_automatic_mission(uuid) from public;
grant execute on function public.complete_automatic_mission(uuid)
to authenticated;

commit;
