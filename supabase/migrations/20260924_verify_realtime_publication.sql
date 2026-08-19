begin;

-- Keep the complete participant notification surface in Realtime. This is
-- intentionally idempotent so it can repair an older project without failing
-- a correctly configured one.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'likes',
    'matches',
    'messages',
    'participant_mission_completions',
    'reward_redemptions',
    'drink_offers',
    'game_table_invitations',
    'dance_invitations',
    'participant_dance_profiles'
  ] loop
    if to_regclass('public.' || v_table) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
       ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end;
$$;

commit;
