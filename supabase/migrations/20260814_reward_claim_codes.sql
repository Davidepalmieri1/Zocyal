begin;

alter table public.reward_redemptions add column if not exists claim_code text;

update public.reward_redemptions
set claim_code = upper(substr(replace(id::text, '-', ''), 1, 8))
where claim_code is null;

alter table public.reward_redemptions
  alter column claim_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  alter column claim_code set not null;

create unique index if not exists reward_redemptions_claim_code_key
  on public.reward_redemptions (claim_code);

create or replace function public.get_missions_rewards_for_event(p_event_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participant uuid := public.current_participant_for_event(v_event);
begin
  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'points_available', public.mr_points_available(v_participant),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mission.id, 'code', mission.code, 'title', mission.title,
        'description', mission.description, 'points', mission.points,
        'verification_mode', mission.verification_mode,
        'completed', completion.id is not null,
        'completed_at', completion.completed_at
      ) order by mission.created_at, mission.id)
      from public.missions mission
      left join public.participant_mission_completions completion
        on completion.mission_id = mission.id
       and completion.participant_id = v_participant
      where mission.event_code = v_event and mission.active
        and (mission.starts_at is null or mission.starts_at <= now())
        and (mission.ends_at is null or mission.ends_at > now())
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', available.id, 'code', available.code, 'name', available.name,
        'description', available.description, 'points_cost', available.points_cost,
        'reward_type', available.reward_type,
        'threshold_points', available.threshold_points,
        'quantity_total', available.quantity_total,
        'quantity_remaining', available.quantity_remaining,
        'redeemed', available.redemption_id is not null,
        'redemption_status', available.redemption_status,
        'claim_code', available.claim_code
      ) order by available.created_at, available.id)
      from (
        select reward.*,
          greatest(reward.quantity_total - count(all_redemption.id)::integer, 0)
            as quantity_remaining,
          own_redemption.id as redemption_id,
          own_redemption.status as redemption_status,
          own_redemption.claim_code
        from public.rewards reward
        left join public.reward_redemptions all_redemption
          on all_redemption.reward_id = reward.id
         and all_redemption.status in ('redeemed', 'fulfilled')
        left join public.reward_redemptions own_redemption
          on own_redemption.reward_id = reward.id
         and own_redemption.participant_id = v_participant
        where reward.event_code = v_event and reward.active
          and (reward.starts_at is null or reward.starts_at <= now())
          and (reward.ends_at is null or reward.ends_at > now())
        group by reward.id, own_redemption.id,
          own_redemption.status, own_redemption.claim_code
      ) available
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_missions_rewards_for_event(text) from public;
grant execute on function public.get_missions_rewards_for_event(text) to authenticated;

commit;
