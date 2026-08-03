begin;

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
  v_participant uuid;
  v_reward public.rewards;
  v_existing public.reward_redemptions;
  v_available integer;
  v_earned bigint;
  v_claimed integer;
begin
  if p_idempotency_key is null then
    raise exception 'Idempotency key required';
  end if;

  select * into v_reward
  from public.rewards reward
  where reward.id = p_reward_id
  for update;

  if v_reward.id is null
     or not v_reward.active
     or v_reward.reward_type <> 'threshold'
     or (v_reward.starts_at is not null and v_reward.starts_at > now())
     or (v_reward.ends_at is not null and v_reward.ends_at <= now()) then
    raise exception 'Reward unavailable';
  end if;

  v_participant := public.current_participant_for_event(v_reward.event_code);
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_participant::text, 0));

  select redemption.* into v_existing
  from public.reward_redemptions redemption
  where redemption.idempotency_key = p_idempotency_key;

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

  perform pg_advisory_xact_lock(
    hashtextextended('mission-rewards:' || v_reward.event_code, 0)
  );

  select coalesce(sum(completion.points_awarded), 0)::bigint
  into v_earned
  from public.participant_mission_completions completion
  where completion.participant_id = v_participant;

  if v_earned < v_reward.threshold_points then
    raise exception 'Reward threshold not reached';
  end if;

  if exists (
    select 1
    from public.reward_redemptions redemption
    where redemption.participant_id = v_participant
      and redemption.reward_id = v_reward.id
  ) then
    raise exception 'Reward already redeemed';
  end if;

  select count(*)::integer into v_claimed
  from public.reward_redemptions redemption
  where redemption.reward_id = v_reward.id
    and redemption.status in ('redeemed', 'fulfilled');

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

revoke all on function public.redeem_reward(uuid, uuid) from public;
grant execute on function public.redeem_reward(uuid, uuid)
to authenticated;

commit;
