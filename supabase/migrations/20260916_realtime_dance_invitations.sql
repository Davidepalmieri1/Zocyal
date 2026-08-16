begin;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dance_invitations'
  ) then
    alter publication supabase_realtime add table public.dance_invitations;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participant_dance_profiles'
  ) then
    alter publication supabase_realtime add table public.participant_dance_profiles;
  end if;
end;
$$;

commit;
