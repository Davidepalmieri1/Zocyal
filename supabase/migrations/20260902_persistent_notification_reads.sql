begin;

create table if not exists public.participant_notification_reads (
  participant_id uuid not null references public.participants(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 160),
  read_at timestamptz not null default now(),
  primary key (participant_id, notification_id)
);

alter table public.participant_notification_reads enable row level security;

drop policy if exists notification_reads_owner_select on public.participant_notification_reads;
create policy notification_reads_owner_select
on public.participant_notification_reads for select to authenticated
using (public.owns_participant(participant_id));

drop policy if exists notification_reads_owner_insert on public.participant_notification_reads;
create policy notification_reads_owner_insert
on public.participant_notification_reads for insert to authenticated
with check (public.owns_participant(participant_id));

revoke all on table public.participant_notification_reads from public, anon, authenticated;
grant select, insert on table public.participant_notification_reads to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participant_mission_completions'
  ) then
    alter publication supabase_realtime add table public.participant_mission_completions;
  end if;
end;
$$;

commit;
