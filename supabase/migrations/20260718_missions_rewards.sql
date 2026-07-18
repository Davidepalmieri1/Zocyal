begin;

create extension if not exists pgcrypto;

-- This migration sorts before 20260718_participant_auth_rls.sql on a clean
-- database, so it makes the participant ownership column available itself.
alter table public.participants
  add column if not exists auth_user_id uuid;

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  code text not null,
  title text not null,
  description text not null default '',
  points integer not null,
  verification_mode text not null default 'automatic',
  verification_key text,
  verification_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_event_code_code_key unique (event_code, code),
  constraint missions_points_nonnegative check (points >= 0),
  constraint missions_valid_window check (
    starts_at is null or ends_at is null or starts_at < ends_at
  ),
  constraint missions_valid_verification check (
    (verification_mode = 'manual' and verification_key is null)
    or
    (
      verification_mode = 'automatic'
      and verification_key in (
        'profile_completed',
        'questionnaire_completed',
        'interests_sent',
        'matches_created',
        'messages_sent'
      )
    )
  ),
  constraint missions_verification_config_object check (
    jsonb_typeof(verification_config) = 'object'
  )
);

create table if not exists public.participant_mission_completions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  points_awarded integer not null,
  verification_mode text not null,
  verification_evidence jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approval_note text,
  completed_at timestamptz not null default now(),
  constraint participant_mission_once unique (participant_id, mission_id),
  constraint mission_completion_points_nonnegative check (points_awarded >= 0),
  constraint mission_completion_mode_valid check (
    verification_mode in ('automatic', 'manual')
  ),
  constraint mission_completion_evidence_object check (
    jsonb_typeof(verification_evidence) = 'object'
  )
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  code text not null,
  name text not null,
  description text not null default '',
  points_cost integer not null,
  quantity_total integer not null,
  reward_type text not null default 'threshold',
  threshold_points integer,
  podium_position integer,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rewards_event_code_code_key unique (event_code, code),
  constraint rewards_points_cost_nonnegative check (points_cost >= 0),
  constraint rewards_quantity_nonnegative check (quantity_total >= 0),
  constraint rewards_threshold_nonnegative check (
    threshold_points is null or threshold_points >= 0
  ),
  constraint rewards_valid_type check (
    (
      reward_type = 'threshold'
      and threshold_points is not null
      and podium_position is null
    )
    or
    (
      reward_type = 'podium_position'
      and threshold_points is null
      and podium_position between 1 and 3
      and starts_at is not null
    )
  ),
  constraint rewards_valid_window check (
    starts_at is null or ends_at is null or starts_at < ends_at
  )
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  idempotency_key uuid not null,
  points_spent integer not null,
  status text not null default 'redeemed',
  redeemed_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid,
  fulfillment_note text,
  constraint reward_redemption_once_per_participant unique (participant_id, reward_id),
  constraint reward_redemption_idempotency_key unique (idempotency_key),
  constraint reward_redemption_points_nonnegative check (points_spent >= 0),
  constraint reward_redemption_status_valid check (
    status in ('redeemed', 'fulfilled')
  ),
  constraint reward_redemption_fulfillment_valid check (
    (status = 'redeemed' and fulfilled_at is null)
    or (status = 'fulfilled' and fulfilled_at is not null)
  )
);

create index if not exists missions_event_active_idx
  on public.missions (event_code, active);
create index if not exists mission_completions_participant_idx
  on public.participant_mission_completions (participant_id, completed_at desc);
create index if not exists rewards_event_active_idx
  on public.rewards (event_code, active);
create index if not exists reward_redemptions_reward_idx
  on public.reward_redemptions (reward_id, status);
create index if not exists reward_redemptions_participant_idx
  on public.reward_redemptions (participant_id, redeemed_at desc);

create or replace function public.mr_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin',
    false
  );
$$;

create or replace function public.mr_current_participant_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.participants p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.mr_current_event_code()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.event_code
  from public.participants p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.mr_points_available(p_participant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    coalesce((
      select sum(c.points_awarded)
      from public.participant_mission_completions c
      where c.participant_id = p_participant_id
    ), 0)
    -
    coalesce((
      select sum(r.points_spent)
      from public.reward_redemptions r
      where r.participant_id = p_participant_id
        and r.status in ('redeemed', 'fulfilled')
    ), 0),
    0
  )::integer;
$$;

-- Internal leaderboard includes participant_id only for authorization checks.
-- The public RPC below deliberately projects a privacy-safe subset.
create or replace function public.mr_event_leaderboard(p_event_code text)
returns table (
  participant_id uuid,
  nickname text,
  avatar_url text,
  points bigint,
  position bigint,
  score_reached_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with scores as (
    select
      p.id as participant_id,
      p.nickname,
      p.avatar_url,
      sum(c.points_awarded)::bigint as points,
      max(c.completed_at) as score_reached_at
    from public.participants p
    join public.participant_mission_completions c
      on c.participant_id = p.id
    where p.event_code = p_event_code
    group by p.id, p.nickname, p.avatar_url
    having sum(c.points_awarded) > 0
  )
  select
    s.participant_id,
    s.nickname,
    s.avatar_url,
    s.points,
    row_number() over (
      order by s.points desc, s.score_reached_at asc, s.participant_id asc
    ) as position,
    s.score_reached_at
  from scores s;
$$;

create or replace function public.get_event_leaderboard()
returns table (
  nickname text,
  avatar_url text,
  points bigint,
  position bigint,
  score_reached_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_event text := public.mr_current_event_code();
begin
  if public.mr_current_participant_id() is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return query
  select
    l.nickname,
    l.avatar_url,
    l.points,
    l.position,
    l.score_reached_at
  from public.mr_event_leaderboard(v_event) l
  where l.position <= 3
  order by l.position;
end;
$$;

-- Returns all participant-visible missions, rewards and the server-derived
-- balance in one snapshot. No caller-controlled participant id is accepted.
create or replace function public.get_missions_rewards()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid := public.mr_current_participant_id();
  v_event text := public.mr_current_event_code();
begin
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'points_available', public.mr_points_available(v_participant),
    'missions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'code', m.code,
          'title', m.title,
          'description', m.description,
          'points', m.points,
          'verification_mode', m.verification_mode,
          'completed', c.id is not null,
          'completed_at', c.completed_at
        ) order by m.created_at, m.id
      )
      from public.missions m
      left join public.participant_mission_completions c
        on c.mission_id = m.id and c.participant_id = v_participant
      where m.event_code = v_event
        and m.active
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', available_reward.id,
          'code', available_reward.code,
          'name', available_reward.name,
          'description', available_reward.description,
          'points_cost', available_reward.points_cost,
          'reward_type', available_reward.reward_type,
          'threshold_points', available_reward.threshold_points,
          'podium_position', available_reward.podium_position,
          'quantity_total', available_reward.quantity_total,
          'quantity_remaining', available_reward.quantity_remaining,
          'redeemed', available_reward.redeemed
        ) order by available_reward.created_at, available_reward.id
      )
      from (
        select
          r.*,
          greatest(r.quantity_total - count(rr.id)::integer, 0)
            as quantity_remaining,
          coalesce(bool_or(rr.participant_id = v_participant), false)
            as redeemed
        from public.rewards r
        left join public.reward_redemptions rr
          on rr.reward_id = r.id and rr.status in ('redeemed', 'fulfilled')
        where r.event_code = v_event
          and r.active
          and (r.starts_at is null or r.starts_at <= now())
          and (r.ends_at is null or r.ends_at > now())
        group by r.id
      ) available_reward
    ), '[]'::jsonb)
  );
end;
$$;

-- Automatic missions are awarded only after re-checking a supported fact in
-- the database. Client-provided evidence is intentionally not accepted.
create or replace function public.complete_automatic_mission(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid := public.mr_current_participant_id();
  v_event text := public.mr_current_event_code();
  v_mission public.missions;
  v_required integer;
  v_observed integer := 0;
  v_completion_id uuid;
  v_inserted boolean := false;
begin
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  select * into v_mission
  from public.missions m
  where m.id = p_mission_id
  for update;

  if v_mission.id is null
     or v_mission.event_code <> v_event
     or not v_mission.active
     or v_mission.verification_mode <> 'automatic'
     or (v_mission.starts_at is not null and v_mission.starts_at > now())
     or (v_mission.ends_at is not null and v_mission.ends_at <= now()) then
    raise exception 'Mission unavailable';
  end if;

  begin
    v_required := coalesce((v_mission.verification_config ->> 'minimum')::integer, 1);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Invalid mission verification configuration';
  end;

  if v_required < 1 then
    raise exception 'Invalid mission verification configuration';
  end if;

  case v_mission.verification_key
    when 'profile_completed' then
      select case when coalesce(p.completed_test, false) then 1 else 0 end
      into v_observed
      from public.participants p where p.id = v_participant;
    when 'questionnaire_completed' then
      select count(*)::integer into v_observed
      from public.answers a where a.participant_id = v_participant;
    when 'interests_sent' then
      select count(*)::integer into v_observed
      from public.likes l where l.from_participant = v_participant;
    when 'matches_created' then
      select count(*)::integer into v_observed
      from public.matches m
      where m.user_one = v_participant or m.user_two = v_participant;
    when 'messages_sent' then
      select count(*)::integer into v_observed
      from public.messages msg where msg.sender_id = v_participant;
    else
      raise exception 'Unsupported automatic verification';
  end case;

  if coalesce(v_observed, 0) < v_required then
    raise exception 'Mission requirements not met';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mission-rewards:' || v_event, 0));

  insert into public.participant_mission_completions (
    participant_id, mission_id, points_awarded, verification_mode,
    verification_evidence
  ) values (
    v_participant, v_mission.id, v_mission.points, 'automatic',
    jsonb_build_object(
      'verification_key', v_mission.verification_key,
      'required', v_required,
      'observed', v_observed,
      'verified_at', now()
    )
  )
  on conflict (participant_id, mission_id) do nothing
  returning id into v_completion_id;

  v_inserted := v_completion_id is not null;

  if not v_inserted then
    select c.id into v_completion_id
    from public.participant_mission_completions c
    where c.participant_id = v_participant
      and c.mission_id = v_mission.id;
  end if;

  return jsonb_build_object(
    'completion_id', v_completion_id,
    'awarded', v_inserted,
    'points_available', public.mr_points_available(v_participant)
  );
end;
$$;

-- Deliberately granted only to service_role below. Manual completion can never
-- be approved with an anon/authenticated browser token.
create or replace function public.approve_manual_mission(
  p_participant_id uuid,
  p_mission_id uuid,
  p_approval_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_mission public.missions;
  v_event text;
  v_completion_id uuid;
  v_inserted boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Backend service role required' using errcode = '42501';
  end if;

  select p.event_code into v_event
  from public.participants p where p.id = p_participant_id;

  select * into v_mission
  from public.missions m
  where m.id = p_mission_id
  for update;

  if v_event is null
     or v_mission.id is null
     or v_mission.event_code <> v_event
     or v_mission.verification_mode <> 'manual'
     or not v_mission.active
     or (v_mission.starts_at is not null and v_mission.starts_at > now())
     or (v_mission.ends_at is not null and v_mission.ends_at <= now()) then
    raise exception 'Manual mission unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mission-rewards:' || v_event, 0));

  insert into public.participant_mission_completions (
    participant_id, mission_id, points_awarded, verification_mode,
    verification_evidence, approved_by, approval_note
  ) values (
    p_participant_id, v_mission.id, v_mission.points, 'manual',
    jsonb_build_object('approved_at', now(), 'source', 'backend_service_role'),
    nullif(auth.jwt() ->> 'sub', '')::uuid,
    left(nullif(trim(p_approval_note), ''), 1000)
  )
  on conflict (participant_id, mission_id) do nothing
  returning id into v_completion_id;

  v_inserted := v_completion_id is not null;

  if not v_inserted then
    select c.id into v_completion_id
    from public.participant_mission_completions c
    where c.participant_id = p_participant_id
      and c.mission_id = p_mission_id;
  end if;

  return jsonb_build_object(
    'completion_id', v_completion_id,
    'awarded', v_inserted,
    'points_available', public.mr_points_available(p_participant_id)
  );
end;
$$;

-- Serializes redemptions per participant and per reward. The unique request key
-- makes retries safe; the participant/reward constraint prevents double claim.
create or replace function public.redeem_reward(
  p_reward_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid := public.mr_current_participant_id();
  v_event text := public.mr_current_event_code();
  v_reward public.rewards;
  v_existing public.reward_redemptions;
  v_available integer;
  v_earned bigint;
  v_claimed integer;
  v_position bigint;
begin
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_participant::text, 0));

  select rr.* into v_existing
  from public.reward_redemptions rr
  where rr.idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    if v_existing.participant_id <> v_participant
       or v_existing.reward_id <> p_reward_id then
      raise exception 'Idempotency key conflict';
    end if;

    return jsonb_build_object(
      'redemption_id', v_existing.id,
      'redeemed', false,
      'idempotent_replay', true,
      'points_available', public.mr_points_available(v_participant)
    );
  end if;

  select * into v_reward
  from public.rewards r
  where r.id = p_reward_id
  for update;

  if v_reward.id is null
     or v_reward.event_code <> v_event
     or not v_reward.active
     or (v_reward.starts_at is not null and v_reward.starts_at > now())
     or (v_reward.ends_at is not null and v_reward.ends_at <= now()) then
    raise exception 'Reward unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mission-rewards:' || v_event, 0));

  select coalesce(sum(c.points_awarded), 0)::bigint
  into v_earned
  from public.participant_mission_completions c
  where c.participant_id = v_participant;

  if v_reward.reward_type = 'threshold'
     and v_earned < v_reward.threshold_points then
    raise exception 'Reward threshold not reached';
  elsif v_reward.reward_type = 'podium_position' then
    select l.position into v_position
    from public.mr_event_leaderboard(v_event) l
    where l.participant_id = v_participant;

    if v_position is distinct from v_reward.podium_position::bigint then
      raise exception 'Podium position not eligible';
    end if;
  end if;

  if exists (
    select 1 from public.reward_redemptions rr
    where rr.participant_id = v_participant
      and rr.reward_id = v_reward.id
  ) then
    raise exception 'Reward already redeemed';
  end if;

  select count(*)::integer into v_claimed
  from public.reward_redemptions rr
  where rr.reward_id = v_reward.id
    and rr.status in ('redeemed', 'fulfilled');

  if v_claimed >= v_reward.quantity_total then
    raise exception 'Reward out of stock';
  end if;

  v_available := public.mr_points_available(v_participant);
  if v_available < v_reward.points_cost then
    raise exception 'Insufficient points';
  end if;

  insert into public.reward_redemptions (
    participant_id, reward_id, idempotency_key, points_spent
  ) values (
    v_participant, v_reward.id, p_idempotency_key, v_reward.points_cost
  )
  returning * into v_existing;

  return jsonb_build_object(
    'redemption_id', v_existing.id,
    'redeemed', true,
    'idempotent_replay', false,
    'points_available', public.mr_points_available(v_participant)
  );
end;
$$;

-- Fulfilment is a backend-only operation and does not change points or stock.
create or replace function public.fulfill_reward_redemption(
  p_redemption_id uuid,
  p_fulfillment_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result public.reward_redemptions;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Backend service role required' using errcode = '42501';
  end if;

  update public.reward_redemptions rr
  set status = 'fulfilled',
      fulfilled_at = coalesce(rr.fulfilled_at, now()),
      fulfilled_by = coalesce(
        rr.fulfilled_by,
        nullif(auth.jwt() ->> 'sub', '')::uuid
      ),
      fulfillment_note = coalesce(
        rr.fulfillment_note,
        left(nullif(trim(p_fulfillment_note), ''), 1000)
      )
  where rr.id = p_redemption_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Redemption not found';
  end if;

  return jsonb_build_object(
    'redemption_id', v_result.id,
    'status', v_result.status,
    'fulfilled_at', v_result.fulfilled_at
  );
end;
$$;

alter table public.missions enable row level security;
alter table public.participant_mission_completions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists missions_participant_read on public.missions;
create policy missions_participant_read
on public.missions for select to authenticated
using (
  public.mr_is_admin()
  or event_code = public.mr_current_event_code()
);

drop policy if exists mission_completions_owner_read
  on public.participant_mission_completions;
create policy mission_completions_owner_read
on public.participant_mission_completions for select to authenticated
using (
  public.mr_is_admin()
  or participant_id = public.mr_current_participant_id()
);

drop policy if exists rewards_participant_read on public.rewards;
create policy rewards_participant_read
on public.rewards for select to authenticated
using (
  public.mr_is_admin()
  or event_code = public.mr_current_event_code()
);

drop policy if exists reward_redemptions_owner_read
  on public.reward_redemptions;
create policy reward_redemptions_owner_read
on public.reward_redemptions for select to authenticated
using (
  public.mr_is_admin()
  or participant_id = public.mr_current_participant_id()
);

revoke all on table public.missions,
  public.participant_mission_completions,
  public.rewards,
  public.reward_redemptions
from public, anon, authenticated;

grant select on table public.missions,
  public.participant_mission_completions,
  public.rewards,
  public.reward_redemptions
to authenticated;

revoke all on function public.mr_is_admin() from public;
revoke all on function public.mr_current_participant_id() from public;
revoke all on function public.mr_current_event_code() from public;
revoke all on function public.mr_points_available(uuid) from public;
revoke all on function public.mr_event_leaderboard(text) from public;
revoke all on function public.get_event_leaderboard() from public;
revoke all on function public.get_missions_rewards() from public;
revoke all on function public.complete_automatic_mission(uuid) from public;
revoke all on function public.approve_manual_mission(uuid, uuid, text) from public;
revoke all on function public.redeem_reward(uuid, uuid) from public;
revoke all on function public.fulfill_reward_redemption(uuid, text) from public;

grant execute on function public.mr_is_admin() to authenticated;
grant execute on function public.mr_current_participant_id() to authenticated;
grant execute on function public.mr_current_event_code() to authenticated;
grant execute on function public.get_missions_rewards() to authenticated;
grant execute on function public.get_event_leaderboard() to authenticated;
grant execute on function public.complete_automatic_mission(uuid) to authenticated;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;

grant execute on function public.approve_manual_mission(uuid, uuid, text)
  to service_role;
grant execute on function public.fulfill_reward_redemption(uuid, text)
  to service_role;

comment on table public.participant_mission_completions is
  'Immutable point ledger: one award per participant and mission.';
comment on table public.reward_redemptions is
  'Immutable point-spend ledger with idempotent, stock-safe redemption.';
comment on function public.approve_manual_mission(uuid, uuid, text) is
  'Backend-only manual mission approval; execute is granted only to service_role.';

commit;
