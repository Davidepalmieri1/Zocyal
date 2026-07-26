begin;

alter table public.events
  add column if not exists experience_mode text not null default 'standard';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_experience_mode_valid'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_experience_mode_valid
      check (experience_mode in ('standard', 'inclusive'));
  end if;
end $$;

comment on column public.events.experience_mode is
  'Organizer-selected event experience mode. Existing events default to standard.';

commit;
