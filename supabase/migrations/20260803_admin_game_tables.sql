begin;

create table public.game_tables (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  game text not null check (char_length(trim(game)) between 1 and 120),
  interest_tags text[] not null default '{}',
  points_reward integer not null default 3 check (points_reward between 1 and 10),
  reward_mission_id uuid not null references public.missions(id) on delete restrict,
  max_participants integer not null default 6 check (max_participants = 6),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_table_invitations (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.game_tables(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'joined')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  joined_at timestamptz,
  points_awarded integer not null default 0 check (points_awarded between 0 and 10),
  unique (table_id, participant_id)
);

create index game_tables_event_status_idx on public.game_tables(event_code, status, created_at desc);
create index game_table_invites_participant_idx on public.game_table_invitations(participant_id, invited_at desc);
create index game_table_invites_table_status_idx on public.game_table_invitations(table_id, status);

alter table public.game_tables enable row level security;
alter table public.game_table_invitations enable row level security;

create policy game_tables_participant_read on public.game_tables for select to authenticated
using (exists (
  select 1 from public.game_table_invitations i
  where i.table_id = id and public.owns_participant(i.participant_id)
));

create policy game_table_invites_owner_read on public.game_table_invitations for select to authenticated
using (public.owns_participant(participant_id));

revoke all on public.game_tables, public.game_table_invitations from anon, authenticated;
grant select on public.game_tables, public.game_table_invitations to authenticated;

create or replace function public.respond_game_table_invitation(p_invitation_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.mr_current_participant_id();
  v_invite public.game_table_invitations%rowtype;
  v_table public.game_tables%rowtype;
  v_occupied integer;
begin
  if v_me is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  select * into v_invite from public.game_table_invitations
  where id = p_invitation_id and participant_id = v_me for update;
  if not found then raise exception 'Invitation not found'; end if;
  if v_invite.status <> 'pending' then raise exception 'Invitation already answered'; end if;

  select * into v_table from public.game_tables where id = v_invite.table_id for update;
  if v_table.status <> 'open' then raise exception 'Table closed'; end if;

  if p_accept then
    select count(*) into v_occupied from public.game_table_invitations
    where table_id = v_table.id and status in ('accepted', 'joined');
    if v_occupied >= v_table.max_participants then raise exception 'Table full'; end if;
  end if;

  update public.game_table_invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = v_invite.id;

  return jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end);
end;
$$;

revoke all on function public.respond_game_table_invitation(uuid, boolean) from public;
grant execute on function public.respond_game_table_invitation(uuid, boolean) to authenticated;

-- Keep invitations live without exposing unrelated participant data.
do $$ begin
  alter publication supabase_realtime add table public.game_table_invitations;
exception when duplicate_object then null;
end $$;

commit;
