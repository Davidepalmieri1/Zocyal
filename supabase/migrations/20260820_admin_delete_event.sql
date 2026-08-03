begin;

create or replace function public.admin_delete_event(p_event_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text := lower(trim(p_event_code));
begin
  if v_event = '' or not exists (select 1 from public.events where code = v_event) then
    raise exception 'Event not found';
  end if;

  delete from public.reward_redemptions
  where reward_id in (select id from public.rewards where event_code = v_event)
     or participant_id in (select id from public.participants where event_code = v_event);
  delete from public.game_tables where event_code = v_event;
  delete from public.participant_mission_completions
  where mission_id in (select id from public.missions where event_code = v_event)
     or participant_id in (select id from public.participants where event_code = v_event);
  delete from public.rewards where event_code = v_event;
  delete from public.missions where event_code = v_event;
  delete from public.drink_offers where event_code = v_event;
  delete from public.participant_recovery_attempts where event_code = v_event;
  delete from public.participants where event_code = v_event;
  delete from public.events where code = v_event;
end;
$$;

revoke all on function public.admin_delete_event(text) from public, anon, authenticated;
grant execute on function public.admin_delete_event(text) to service_role;

commit;
