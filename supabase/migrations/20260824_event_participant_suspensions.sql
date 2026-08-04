begin;

create table if not exists public.event_participant_bans (
  event_code text not null references public.events(code) on delete cascade,
  auth_user_id uuid not null,
  original_participant_id uuid,
  nickname text,
  banned_at timestamptz not null default now(),
  primary key (event_code, auth_user_id)
);

alter table public.event_participant_bans enable row level security;
revoke all on table public.event_participant_bans from public, anon, authenticated;

create or replace function public.reject_banned_participant_identity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.auth_user_id is not null and exists (
    select 1 from public.event_participant_bans ban
    where ban.event_code = lower(trim(new.event_code))
      and ban.auth_user_id = new.auth_user_id
  ) then
    raise exception 'Participant suspended for this event' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists participants_reject_banned_identity on public.participants;
create trigger participants_reject_banned_identity
before insert or update of auth_user_id, event_code on public.participants
for each row execute function public.reject_banned_participant_identity();

create or replace function public.admin_suspend_participant(p_event_code text, p_participant_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_event text := lower(trim(p_event_code));
  v_auth_user_id uuid;
  v_nickname text;
begin
  select auth_user_id, nickname into v_auth_user_id, v_nickname
  from public.participants
  where id = p_participant_id and event_code = v_event
  for update;
  if not found then raise exception 'Participant not found in event'; end if;
  if v_auth_user_id is null then raise exception 'Participant identity unavailable'; end if;

  insert into public.event_participant_bans(event_code, auth_user_id, original_participant_id, nickname)
  values (v_event, v_auth_user_id, p_participant_id, v_nickname)
  on conflict (event_code, auth_user_id) do update
  set original_participant_id = excluded.original_participant_id,
      nickname = excluded.nickname,
      banned_at = now();

  update public.matches set status = 'blocked'
  where user_one = p_participant_id or user_two = p_participant_id;
  delete from public.likes
  where from_participant = p_participant_id or to_participant = p_participant_id;
  update public.participants
  set auth_user_id = null, recovery_code = null, recovery_code_hash = null
  where id = p_participant_id;
end;
$$;

create or replace function public.admin_delete_participant(p_event_code text, p_participant_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_event text := lower(trim(p_event_code));
  v_auth_user_id uuid;
  v_nickname text;
begin
  select auth_user_id, nickname into v_auth_user_id, v_nickname
  from public.participants
  where id = p_participant_id and event_code = v_event
  for update;
  if not found then raise exception 'Participant not found in event'; end if;

  if v_auth_user_id is not null then
    insert into public.event_participant_bans(event_code, auth_user_id, original_participant_id, nickname)
    values (v_event, v_auth_user_id, p_participant_id, v_nickname)
    on conflict (event_code, auth_user_id) do update
    set original_participant_id = excluded.original_participant_id,
        nickname = excluded.nickname,
        banned_at = now();
  end if;

  delete from public.reward_redemptions where participant_id = p_participant_id;
  delete from public.participant_mission_completions where participant_id = p_participant_id;
  delete from public.reports where reported_by = p_participant_id or reported_participant = p_participant_id;
  delete from public.participant_blocks where blocked_by = p_participant_id or blocked_participant = p_participant_id;
  delete from public.likes where from_participant = p_participant_id or to_participant = p_participant_id;
  delete from public.matches where user_one = p_participant_id or user_two = p_participant_id;
  delete from public.participants where id = p_participant_id and event_code = v_event;
end;
$$;

revoke all on function public.reject_banned_participant_identity() from public, anon, authenticated;
revoke all on function public.admin_suspend_participant(text, uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_participant(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_suspend_participant(text, uuid) to service_role;
grant execute on function public.admin_delete_participant(text, uuid) to service_role;

commit;
