begin;

delete from public.rewards
where reward_type = 'podium_position';

create or replace function public.get_event_leaderboard_for_event(
  p_event_code text
)
returns table (
  nickname text,
  avatar_url text,
  points bigint,
  rank_position bigint,
  score_reached_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_event text := lower(trim(p_event_code));
begin
  if public.current_participant_for_event(v_event) is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return query
  select
    leaderboard.nickname,
    leaderboard.avatar_url,
    leaderboard.points,
    leaderboard.rank_position,
    leaderboard.score_reached_at
  from public.mr_event_leaderboard(v_event) leaderboard
  where leaderboard.rank_position <= 3
  order by leaderboard.rank_position;
end;
$$;

revoke all on function public.get_event_leaderboard_for_event(text) from public;
grant execute on function public.get_event_leaderboard_for_event(text)
to authenticated;

commit;
