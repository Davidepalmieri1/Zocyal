alter table public.events
  add column if not exists description text not null default '',
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists timezone text not null default 'Europe/Rome',
  add column if not exists status text not null default 'open',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_status_valid') then
    alter table public.events add constraint events_status_valid
      check (status in ('draft', 'open', 'closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_window_valid') then
    alter table public.events add constraint events_window_valid
      check (starts_at is null or ends_at is null or starts_at < ends_at);
  end if;
end $$;

create or replace function public.guard_event_participant_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event public.events;
begin
  select * into v_event from public.events where code = new.event_code;
  if not found then raise exception 'Event not found'; end if;
  if v_event.status <> 'open' then raise exception 'Event registrations are closed'; end if;
  if v_event.starts_at is not null and v_event.starts_at > now() then raise exception 'Event has not started yet'; end if;
  if v_event.ends_at is not null and v_event.ends_at <= now() then raise exception 'Event has ended'; end if;
  return new;
end;
$$;

drop trigger if exists participants_event_registration_guard on public.participants;
create trigger participants_event_registration_guard before insert on public.participants
for each row execute function public.guard_event_participant_registration();
revoke all on function public.guard_event_participant_registration() from public;

