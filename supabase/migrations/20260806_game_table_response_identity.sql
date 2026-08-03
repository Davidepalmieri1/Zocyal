begin;

create or replace function public.respond_game_table_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.game_table_invitations%rowtype;
  v_table public.game_tables%rowtype;
  v_occupied integer;
begin
  if auth.uid() is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  select invitation.*
  into v_invite
  from public.game_table_invitations invitation
  where invitation.id = p_invitation_id
    and public.owns_participant(invitation.participant_id)
  for update;

  if not found then raise exception 'Invitation not found'; end if;
  if v_invite.status <> 'pending' then
    raise exception 'Invitation already answered';
  end if;

  select * into v_table
  from public.game_tables
  where id = v_invite.table_id
  for update;

  if v_table.status <> 'open' then raise exception 'Table closed'; end if;

  if p_accept then
    select count(*) into v_occupied
    from public.game_table_invitations
    where table_id = v_table.id
      and status in ('accepted', 'joined');

    if v_occupied >= v_table.max_participants then
      raise exception 'Table full';
    end if;
  end if;

  update public.game_table_invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'status',
    case when p_accept then 'accepted' else 'declined' end
  );
end;
$$;

revoke all on function public.respond_game_table_invitation(uuid, boolean)
from public;
grant execute on function public.respond_game_table_invitation(uuid, boolean)
to authenticated;

commit;
