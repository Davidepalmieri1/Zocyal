begin;

create table if not exists public.mission_validation_requests (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  participant_id uuid not null references public.participants(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (participant_id, mission_id)
);

create index if not exists mission_validation_requests_event_pending_idx
  on public.mission_validation_requests(event_code,status,requested_at);

alter table public.mission_validation_requests enable row level security;
drop policy if exists mission_validation_requests_owner_read on public.mission_validation_requests;
create policy mission_validation_requests_owner_read
on public.mission_validation_requests for select to authenticated
using (public.owns_participant(participant_id));

revoke all on table public.mission_validation_requests from public,anon,authenticated;
grant select on table public.mission_validation_requests to authenticated;

create or replace function public.request_manual_mission_validation(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_participant uuid := public.mr_current_participant_id();
  v_event text;
  v_request uuid;
begin
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode='28000';
  end if;

  select participant.event_code into v_event
  from public.participants participant
  where participant.id = v_participant;

  if not exists (
    select 1 from public.missions mission
    where mission.id = p_mission_id
      and mission.event_code = v_event
      and mission.active
      and mission.verification_mode = 'manual'
      and (mission.starts_at is null or mission.starts_at <= now())
      and (mission.ends_at is null or mission.ends_at > now())
  ) then
    raise exception 'Manual mission unavailable';
  end if;

  if exists (
    select 1 from public.participant_mission_completions completion
    where completion.participant_id = v_participant
      and completion.mission_id = p_mission_id
  ) then
    raise exception 'Mission already completed';
  end if;

  insert into public.mission_validation_requests(event_code,participant_id,mission_id,status,requested_at,resolved_at)
  values(v_event,v_participant,p_mission_id,'pending',now(),null)
  on conflict(participant_id,mission_id) do update
  set status='pending',requested_at=now(),resolved_at=null
  returning id into v_request;

  return jsonb_build_object('request_id',v_request,'status','pending');
end;
$$;

revoke all on function public.request_manual_mission_validation(uuid) from public,anon;
grant execute on function public.request_manual_mission_validation(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='mission_validation_requests'
  ) then
    alter publication supabase_realtime add table public.mission_validation_requests;
  end if;
end;
$$;

commit;
