begin;

-- If an event already has a separately configured profile mission, keep the
-- generated legacy mission only as history so existing point awards remain
-- valid, but prevent it from being offered or awarded again.
update public.missions legacy
set active = false
where legacy.code = 'profile-completed'
  and legacy.verification_key = 'profile_completed'
  and legacy.active
  and exists (
    select 1
    from public.missions configured
    where configured.event_code = legacy.event_code
      and configured.id <> legacy.id
      and configured.verification_key = 'profile_completed'
      and configured.verification_mode = 'automatic'
      and configured.active
  );

create or replace function public.award_profile_completion_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
begin
  if not coalesce(new.completed_test, false) then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.completed_test, false) then return new; end if;

  -- Missions are event configuration. Never recreate a mission that an
  -- organizer intentionally deleted. Prefer a custom configured mission over
  -- the legacy generated one when both are still present.
  select mission.* into v_mission
  from public.missions mission
  where mission.event_code = new.event_code
    and mission.verification_key = 'profile_completed'
    and mission.verification_mode = 'automatic'
    and mission.active
    and (mission.starts_at is null or mission.starts_at <= now())
    and (mission.ends_at is null or mission.ends_at > now())
  order by
    case when mission.code = 'profile-completed' then 1 else 0 end,
    mission.created_at,
    mission.id
  limit 1;

  if v_mission.id is null then return new; end if;

  insert into public.participant_mission_completions (
    participant_id, mission_id, points_awarded,
    verification_mode, verification_evidence
  ) values (
    new.id,
    v_mission.id,
    v_mission.points,
    'automatic',
    jsonb_build_object('source', 'profile_completion_trigger')
  )
  on conflict (participant_id, mission_id) do nothing;

  return new;
end;
$$;

commit;
