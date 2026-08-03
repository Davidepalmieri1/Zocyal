begin;

create or replace function public.get_missions_rewards_for_event(p_event_code text)
returns jsonb
language plpgsql stable security definer
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
    'missions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'code', m.code, 'title', m.title,
      'description', m.description, 'points', m.points,
      'verification_mode', m.verification_mode,
      'completed', c.id is not null, 'completed_at', c.completed_at
    ) order by m.created_at, m.id)
      from public.missions m
      left join public.participant_mission_completions c
        on c.mission_id = m.id and c.participant_id = v_participant
      where m.event_code = v_event and m.active
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    ), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'code', a.code, 'name', a.name,
      'description', a.description, 'points_cost', a.points_cost,
      'reward_type', a.reward_type, 'threshold_points', a.threshold_points,
      'quantity_total', a.quantity_total,
      'quantity_remaining', a.quantity_remaining,
      'redeemed', a.redemption_id is not null,
      'redemption_status', a.redemption_status, 'claim_code', a.claim_code
    ) order by a.created_at, a.id)
      from (
        select r.*,
          greatest(r.quantity_total - count(all_rr.id)::integer, 0) as quantity_remaining,
          own_rr.id as redemption_id, own_rr.status as redemption_status,
          own_rr.claim_code
        from public.rewards r
        left join public.reward_redemptions all_rr
          on all_rr.reward_id = r.id and all_rr.status in ('redeemed', 'fulfilled')
        left join public.reward_redemptions own_rr
          on own_rr.reward_id = r.id and own_rr.participant_id = v_participant
        where r.event_code = v_event and r.active
          and (r.starts_at is null or r.starts_at <= now())
          and (r.ends_at is null or r.ends_at > now())
        group by r.id, own_rr.id, own_rr.status, own_rr.claim_code
      ) a
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_missions_rewards_for_event(text) from public;
grant execute on function public.get_missions_rewards_for_event(text) to authenticated;

commit;
