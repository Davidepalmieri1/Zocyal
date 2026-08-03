begin;

alter table public.events
  add column if not exists venue_logo_url text,
  add column if not exists venue_poster_url text;

comment on column public.events.venue_logo_url is
  'Public URL of the venue logo uploaded by an administrator.';
comment on column public.events.venue_poster_url is
  'Public URL of the venue poster uploaded by an administrator.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-assets', 'event-assets', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
