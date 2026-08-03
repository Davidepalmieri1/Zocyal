begin;

insert into public.missions (
  event_code, code, title, description, points,
  verification_mode, verification_key, active
)
select
  e.code,
  'profile-completed',
  'Completa il profilo ZOCYAL',
  'Completa il profilo e il questionario della serata.',
  10,
  'automatic',
  'profile_completed',
  true
from public.events e
on conflict (event_code, code) do nothing;

insert into public.participant_mission_completions (
  participant_id, mission_id, points_awarded,
  verification_mode, verification_evidence
)
select
  p.id,
  m.id,
  m.points,
  'automatic',
  jsonb_build_object('source', 'profile_completion_backfill')
from public.participants p
join public.missions m
  on m.event_code = p.event_code
 and m.code = 'profile-completed'
where coalesce(p.completed_test, false)
on conflict (participant_id, mission_id) do nothing;

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

  insert into public.missions (
    event_code, code, title, description, points,
    verification_mode, verification_key, active
  ) values (
    new.event_code,
    'profile-completed',
    'Completa il profilo ZOCYAL',
    'Completa il profilo e il questionario della serata.',
    10,
    'automatic',
    'profile_completed',
    true
  )
  on conflict (event_code, code) do update
    set event_code = excluded.event_code
  returning * into v_mission;

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

do $$
begin
  create trigger participants_award_profile_completion
  after insert or update of completed_test
  on public.participants
  for each row
  execute function public.award_profile_completion_points();
exception
  when duplicate_object then null;
end;
$$;

commit;
