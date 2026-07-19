create unique index if not exists events_code_unique_idx on public.events(code);

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
for select to anon, authenticated
using (
  status = 'open'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

