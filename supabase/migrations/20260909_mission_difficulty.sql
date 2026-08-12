begin;

alter table public.missions
  add column if not exists difficulty text not null default 'easy';

alter table public.missions
  drop constraint if exists missions_difficulty_valid;
alter table public.missions
  add constraint missions_difficulty_valid
  check (difficulty in ('easy', 'medium', 'special'));

alter table public.engagement_templates
  add column if not exists difficulty text;

alter table public.engagement_templates
  drop constraint if exists engagement_templates_difficulty_valid;
alter table public.engagement_templates
  add constraint engagement_templates_difficulty_valid
  check (difficulty is null or difficulty in ('easy', 'medium', 'special'));

update public.missions
set difficulty = case
  when verification_key in ('profile_completed', 'questionnaire_completed') then 'easy'
  when verification_key in ('interests_sent', 'messages_sent') then 'medium'
  when verification_key = 'matches_created' then 'special'
  when verification_mode = 'manual' and points >= 30 then 'special'
  when verification_mode = 'manual' and points >= 15 then 'medium'
  when points >= 30 then 'special'
  when points >= 15 then 'medium'
  else 'easy'
end;

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
      select jsonb_agg(jsonb_build_object(
        'id', mission.id,
        'code', mission.code,
        'title', mission.title,
        'description', mission.description,
        'points', mission.points,
        'difficulty', mission.difficulty,
        'verification_mode', mission.verification_mode,
        'completed', completion.id is not null,
        'completed_at', completion.completed_at
      ) order by
        case mission.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end,
        completion.id is not null,
        mission.points,
        mission.created_at
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
      select jsonb_agg(jsonb_build_object(
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
      ) order by available.threshold_points, available.created_at)
      from (
        select reward.*,
          greatest(reward.quantity_total - count(redemption.id)::integer, 0) as quantity_remaining,
          coalesce(bool_or(redemption.participant_id = v_participant), false) as redeemed
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
grant execute on function public.get_missions_rewards_for_event(text) to authenticated;

commit;
