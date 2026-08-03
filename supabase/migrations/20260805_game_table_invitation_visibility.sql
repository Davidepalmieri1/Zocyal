begin;

create or replace function public.can_read_game_table(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.game_table_invitations invitation
    where invitation.table_id = p_table_id
      and public.owns_participant(invitation.participant_id)
  );
$$;

revoke all on function public.can_read_game_table(uuid) from public;
grant execute on function public.can_read_game_table(uuid) to authenticated;

drop policy if exists game_tables_participant_read on public.game_tables;
create policy game_tables_participant_read
on public.game_tables
for select
to authenticated
using (public.can_read_game_table(id));

commit;
