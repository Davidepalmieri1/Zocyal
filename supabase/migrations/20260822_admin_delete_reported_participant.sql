begin;

create or replace function public.admin_delete_participant(
  p_event_code text,
  p_participant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text := lower(trim(p_event_code));
begin
  if not exists (
    select 1 from public.participants
    where id = p_participant_id and event_code = v_event
  ) then
    raise exception 'Participant not found in event';
  end if;

  delete from public.reward_redemptions where participant_id = p_participant_id;
  delete from public.participant_mission_completions where participant_id = p_participant_id;
  delete from public.reports
  where reported_by = p_participant_id or reported_participant = p_participant_id;
  delete from public.participant_blocks
  where blocked_by = p_participant_id or blocked_participant = p_participant_id;
  delete from public.likes
  where from_participant = p_participant_id or to_participant = p_participant_id;
  delete from public.matches
  where user_one = p_participant_id or user_two = p_participant_id;
  delete from public.participants
  where id = p_participant_id and event_code = v_event;
end;
$$;

revoke all on function public.admin_delete_participant(text, uuid)
from public, anon, authenticated;
grant execute on function public.admin_delete_participant(text, uuid) to service_role;

commit;
