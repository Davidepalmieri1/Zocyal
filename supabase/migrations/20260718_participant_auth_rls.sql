begin;

create extension if not exists pgcrypto;

alter table public.participants
  add column if not exists auth_user_id uuid;

alter table public.participants
  add column if not exists recovery_code_hash text;

alter table public.participants
  alter column recovery_code drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'participants_auth_user_id_fkey'
      and conrelid = 'public.participants'::regclass
  ) then
    alter table public.participants
      add constraint participants_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id)
      on delete set null not valid;
  end if;
end;
$$;

drop index if exists public.participants_auth_user_id_uidx;

create unique index if not exists participants_auth_user_event_uidx
  on public.participants (auth_user_id, event_code)
  where auth_user_id is not null;

create index if not exists participants_recovery_code_hash_idx
  on public.participants (recovery_code_hash)
  where recovery_code_hash is not null;

-- Preserve recovery of legacy rows. New codes are longer and are never persisted
-- in clear text. Legacy clear-text values are removed after their hash is stored.
update public.participants
set recovery_code_hash = encode(
      extensions.digest(upper(trim(recovery_code)), 'sha256'),
      'hex'
    )
where recovery_code_hash is null
  and nullif(trim(recovery_code), '') is not null;

update public.participants
set recovery_code = null
where recovery_code is not null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, extensions
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin',
    false
  );
$$;

create or replace function public.owns_participant(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, extensions
as $$
  select exists (
    select 1
    from public.participants p
    where p.id = p_participant_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function public.shares_participant_event(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.participants mine
    join public.participants other
      on other.event_code = mine.event_code
    where mine.auth_user_id = auth.uid()
      and other.id = p_participant_id
  );
$$;

create or replace function public.can_access_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin() or exists (
    select 1
    from public.matches m
    join public.participants p
      on p.id in (m.user_one, m.user_two)
    where m.id = p_match_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function public.match_is_blocked(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participant_blocks b
    where b.match_id = p_match_id
  );
$$;

-- Creates one participant owned by the current Supabase user. The recovery code
-- is returned once in the JSON response and only its hash is stored.
create or replace function public.create_participant(
  p_event_code text,
  p_nickname text,
  p_age integer,
  p_gender text,
  p_goal text,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_code text := upper(encode(extensions.gen_random_bytes(16), 'hex'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.events e where e.code = lower(trim(p_event_code))
  ) then
    raise exception 'Invalid event';
  end if;

  if nullif(trim(p_nickname), '') is null
     or p_age is null or p_age < 18 or p_age > 120
     or nullif(trim(p_gender), '') is null
     or nullif(trim(p_goal), '') is null then
    raise exception 'Invalid participant data';
  end if;

  if exists (
    select 1 from public.participants p
    where p.auth_user_id = auth.uid()
      and p.event_code = lower(trim(p_event_code))
  ) then
    raise exception 'This account already owns a participant';
  end if;

  insert into public.participants (
    event_code, nickname, age, gender, goal, avatar_url,
    auth_user_id, recovery_code, recovery_code_hash
  ) values (
    lower(trim(p_event_code)), trim(p_nickname), p_age, trim(p_gender),
    trim(p_goal), nullif(trim(p_avatar_url), ''), auth.uid(), null,
    encode(extensions.digest(v_code, 'sha256'), 'hex')
  )
  returning id into v_id;

  return jsonb_build_object('participant_id', v_id, 'recovery_code', v_code);
end;
$$;

-- Claims an existing, currently unowned participant. A successful claim rotates
-- the secret so the supplied recovery code cannot be replayed.
create or replace function public.claim_participant(
  p_event_code text,
  p_recovery_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_new_code text := upper(encode(extensions.gen_random_bytes(16), 'hex'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if nullif(trim(p_recovery_code), '') is null then
    raise exception 'Invalid recovery credentials';
  end if;

  if exists (
    select 1 from public.participants p
    where p.auth_user_id = auth.uid()
      and p.event_code = lower(trim(p_event_code))
  ) then
    raise exception 'This account already owns a participant';
  end if;

  update public.participants p
  set auth_user_id = auth.uid(),
      recovery_code = null,
      recovery_code_hash = encode(extensions.digest(v_new_code, 'sha256'), 'hex')
  where p.event_code = lower(trim(p_event_code))
    and p.auth_user_id is null
    and p.recovery_code_hash = encode(
      extensions.digest(upper(trim(p_recovery_code)), 'sha256'),
      'hex'
    )
  returning p.id into v_id;

  if v_id is null then
    raise exception 'Invalid recovery credentials';
  end if;

  return jsonb_build_object('participant_id', v_id, 'recovery_code', v_new_code);
end;
$$;

-- Records an interest from the caller's participant. If the interest is mutual,
-- creates (or reuses) the match atomically and returns its id.
create or replace function public.send_interest(p_to_participant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_from uuid;
  v_event text;
  v_match_id uuid;
  v_mutual boolean := false;
begin
  select p.id, p.event_code
  into v_from, v_event
  from public.participants p
  join public.participants target
    on target.id = p_to_participant
   and target.event_code = p.event_code
  where p.auth_user_id = auth.uid()
  limit 1;

  if v_from is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  if p_to_participant = v_from or not exists (
    select 1 from public.participants p
    where p.id = p_to_participant and p.event_code = v_event
  ) then
    raise exception 'Invalid interest target';
  end if;

  if exists (
    select 1 from public.participant_blocks b
    where (b.blocked_by = v_from and b.blocked_participant = p_to_participant)
       or (b.blocked_by = p_to_participant and b.blocked_participant = v_from)
  ) then
    raise exception 'Interaction unavailable';
  end if;

  insert into public.likes (from_participant, to_participant)
  values (v_from, p_to_participant)
  on conflict do nothing;

  select exists (
    select 1 from public.likes l
    where l.from_participant = p_to_participant
      and l.to_participant = v_from
  ) into v_mutual;

  if v_mutual then
    perform pg_advisory_xact_lock(
      hashtextextended(least(v_from::text, p_to_participant::text)
        || ':' || greatest(v_from::text, p_to_participant::text), 0)
    );

    select m.id into v_match_id
    from public.matches m
    where (m.user_one = v_from and m.user_two = p_to_participant)
       or (m.user_one = p_to_participant and m.user_two = v_from)
    limit 1;

    if v_match_id is null then
      insert into public.matches (user_one, user_two, status)
      values (v_from, p_to_participant, 'matched')
      returning id into v_match_id;
    end if;
  end if;

  return jsonb_build_object('mutual', v_mutual, 'match_id', v_match_id);
end;
$$;

create or replace function public.block_report(
  p_match_id uuid,
  p_reason text,
  p_details text default null,
  p_create_report boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid;
  v_other uuid;
begin
  select p.id into v_me
  from public.participants p
  where p.auth_user_id = auth.uid();

  select case
    when m.user_one = v_me then m.user_two
    when m.user_two = v_me then m.user_one
  end into v_other
  from public.matches m
  where m.id = p_match_id;

  if v_me is null or v_other is null then
    raise exception 'Match access denied' using errcode = '42501';
  end if;

  insert into public.participant_blocks (
    match_id, blocked_by, blocked_participant, reason
  ) values (
    p_match_id, v_me, v_other,
    coalesce(nullif(trim(p_reason), ''), 'Blocco senza segnalazione')
  )
  on conflict (match_id, blocked_by) do update
  set blocked_participant = excluded.blocked_participant,
      reason = excluded.reason;

  if p_create_report then
    insert into public.reports (
      match_id, reported_by, reported_participant, reason, details
    )
    select p_match_id, v_me, v_other,
      coalesce(nullif(trim(p_reason), ''), 'Altro'),
      left(nullif(trim(p_details), ''), 2000)
    where not exists (
      select 1 from public.reports r
      where r.match_id = p_match_id and r.reported_by = v_me
    );
  end if;

  update public.matches set status = 'blocked' where id = p_match_id;
end;
$$;

-- All message creation goes through this function; sender_id is derived from
-- auth.uid(), never accepted from the browser.
create or replace function public.create_message(
  p_match_id uuid,
  p_message text
)
returns public.messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid;
  v_result public.messages;
begin
  select p.id into v_me
  from public.participants p
  where p.auth_user_id = auth.uid();

  if v_me is null
     or not public.can_access_match(p_match_id)
     or public.match_is_blocked(p_match_id) then
    raise exception 'Match access denied' using errcode = '42501';
  end if;

  if nullif(trim(p_message), '') is null or length(trim(p_message)) > 2000 then
    raise exception 'Invalid message';
  end if;

  insert into public.messages (match_id, sender_id, message)
  values (p_match_id, v_me, trim(p_message))
  returning * into v_result;

  return v_result;
end;
$$;

-- Remove every pre-existing policy on the protected participant tables so the
-- resulting model is deterministic and deny-by-default.
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'participants', 'answers', 'likes', 'matches', 'messages',
    'reports', 'participant_blocks'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
  end loop;
end;
$$;

create policy participants_select_same_event
on public.participants for select to authenticated
using (
  public.is_admin()
  or public.owns_participant(id)
  or public.shares_participant_event(id)
);

create policy participants_update_owner
on public.participants for update to authenticated
using (public.is_admin() or public.owns_participant(id))
with check (
  public.is_admin()
  or (public.owns_participant(id) and auth_user_id = auth.uid())
);

create policy answers_select_same_event
on public.answers for select to authenticated
using (public.is_admin() or public.shares_participant_event(participant_id));

create policy answers_insert_owner
on public.answers for insert to authenticated
with check (public.owns_participant(participant_id));

create policy answers_update_owner
on public.answers for update to authenticated
using (public.is_admin() or public.owns_participant(participant_id))
with check (public.is_admin() or public.owns_participant(participant_id));

create policy answers_delete_owner
on public.answers for delete to authenticated
using (public.is_admin() or public.owns_participant(participant_id));

create policy likes_select_involved
on public.likes for select to authenticated
using (
  public.is_admin()
  or public.owns_participant(from_participant)
  or public.owns_participant(to_participant)
);

create policy likes_insert_owner
on public.likes for insert to authenticated
with check (
  public.owns_participant(from_participant)
  and public.shares_participant_event(to_participant)
  and from_participant <> to_participant
);

create policy matches_select_member
on public.matches for select to authenticated
using (
  public.is_admin()
  or public.owns_participant(user_one)
  or public.owns_participant(user_two)
);

create policy matches_insert_mutual_like
on public.matches for insert to authenticated
with check (
  (public.owns_participant(user_one) or public.owns_participant(user_two))
  and exists (
    select 1 from public.likes a
    join public.likes b
      on b.from_participant = a.to_participant
     and b.to_participant = a.from_participant
    where a.from_participant = user_one
      and a.to_participant = user_two
  )
);

create policy messages_select_match_member
on public.messages for select to authenticated
using (public.can_access_match(match_id));

create policy messages_update_read_receipt
on public.messages for update to authenticated
using (
  public.can_access_match(match_id)
  and not public.owns_participant(sender_id)
  and not public.match_is_blocked(match_id)
)
with check (
  public.can_access_match(match_id)
  and not public.owns_participant(sender_id)
  and not public.match_is_blocked(match_id)
);

create policy reports_select_admin
on public.reports for select to authenticated
using (public.is_admin());

create policy participant_blocks_select_involved
on public.participant_blocks for select to authenticated
using (
  public.is_admin()
  or public.owns_participant(blocked_by)
  or public.owns_participant(blocked_participant)
);

-- Events remain readable to enter an experience. Mutations remain unavailable.
alter table public.events enable row level security;
drop policy if exists events_public_read on public.events;
create policy events_public_read
on public.events for select to anon, authenticated
using (true);

-- Public avatars remain readable. Uploads are restricted to authenticated users
-- and to an object prefix equal to their auth user id.
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
);

-- Table grants expose only the minimum data needed by the participant UI.
revoke all on table public.participants, public.answers, public.likes,
  public.matches, public.messages, public.reports, public.participant_blocks
from anon, authenticated;

grant select (id, event_code, nickname, age, gender, goal, avatar_url,
  completed_test) on public.participants to authenticated;
grant update (nickname, age, gender, goal, avatar_url, completed_test)
  on public.participants to authenticated;

grant select, insert, update, delete on public.answers to authenticated;
grant select, insert on public.likes, public.matches to authenticated;
grant select on public.messages,
  public.participant_blocks to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select on public.reports to authenticated;
grant select on public.events to anon, authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.owns_participant(uuid) from public;
revoke all on function public.shares_participant_event(uuid) from public;
revoke all on function public.can_access_match(uuid) from public;
revoke all on function public.match_is_blocked(uuid) from public;
revoke all on function public.create_participant(text, text, integer, text, text, text) from public;
revoke all on function public.claim_participant(text, text) from public;
revoke all on function public.send_interest(uuid) from public;
revoke all on function public.block_report(uuid, text, text, boolean) from public;
revoke all on function public.create_message(uuid, text) from public;

grant execute on function public.create_participant(text, text, integer, text, text, text)
  to authenticated;
grant execute on function public.claim_participant(text, text) to authenticated;
grant execute on function public.send_interest(uuid) to authenticated;
grant execute on function public.block_report(uuid, text, text, boolean)
  to authenticated;
grant execute on function public.create_message(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_participant(uuid) to authenticated;
grant execute on function public.shares_participant_event(uuid) to authenticated;
grant execute on function public.can_access_match(uuid) to authenticated;
grant execute on function public.match_is_blocked(uuid) to authenticated;

-- Retire the legacy code-authenticated RPC; it bypasses auth_user_id ownership.
do $$
begin
  if to_regprocedure('public.block_and_report(uuid,uuid,text,text,text,boolean)') is not null then
    revoke all on function public.block_and_report(uuid, uuid, text, text, text, boolean)
      from public, anon, authenticated;
  end if;
end;
$$;

comment on column public.participants.auth_user_id is
  'Supabase Auth owner. Null only for legacy, not-yet-claimed participants.';
comment on column public.participants.recovery_code_hash is
  'SHA-256 of normalized recovery code; code is returned once and never stored clear-text.';

commit;
