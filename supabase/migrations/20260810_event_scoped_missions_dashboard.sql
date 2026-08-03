begin;

create or replace function public.get_missions_rewards_for_event(
  p_event_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participant uuid;
begin
  v_participant := public.current_participant_for_event(v_event);

  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'points_available', public.mr_points_available(v_participant),
    'missions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', mission.id,
          'code', mission.code,
          'title', mission.title,
          'description', mission.description,
          'points', mission.points,
          'verification_mode', mission.verification_mode,
          'completed', completion.id is not null,
          'completed_at', completion.completed_at
        ) order by mission.created_at, mission.id
      )
      from public.missions mission
      left join public.participant_mission_completions completion
        on completion.mission_id = mission.id
       and completion.participant_id = v_participant
      where mission.event_code = v_event
        and mission.active
        and (mission.starts_at is null or mission.starts_at <= now())
        and (mission.ends_at is null or mission.ends_at > now())
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', available.id,
          'code', available.code,
          'name', available.name,
          'description', available.description,
          'points_cost', available.points_cost,
          'reward_type', available.reward_type,
          'threshold_points', available.threshold_points,
          'podium_position', available.podium_position,
          'quantity_total', available.quantity_total,
          'quantity_remaining', available.quantity_remaining,
          'redeemed', available.redeemed
        ) order by available.created_at, available.id
      )
      from (
        select
          reward.*,
          greatest(reward.quantity_total - count(redemption.id)::integer, 0)
            as quantity_remaining,
          coalesce(bool_or(redemption.participant_id = v_participant), false)
            as redeemed
        from public.rewards reward
        left join public.reward_redemptions redemption
          on redemption.reward_id = reward.id
         and redemption.status in ('redeemed', 'fulfilled')
        where reward.event_code = v_event
          and reward.active
          and reward.reward_type = 'threshold'
          and (reward.starts_at is null or reward.starts_at <= now())
          and (reward.ends_at is null or reward.ends_at > now())
        group by reward.id
      ) available
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_missions_rewards_for_event(text) from public;
grant execute on function public.get_missions_rewards_for_event(text)
to authenticated;

commit;
