begin;

create or replace function public.admin_reset_event_participants(p_event_code text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participant_count integer;
begin
  if v_event = '' or not exists (select 1 from public.events where code = v_event) then
    raise exception 'Event not found';
  end if;

  select count(*)::integer
  into v_participant_count
  from public.participants
  where event_code = v_event;

  -- Runtime data is cleared, while the event, its settings, missions and rewards remain.
  delete from public.reward_redemptions
  where participant_id in (select id from public.participants where event_code = v_event);

  delete from public.participant_mission_completions
  where participant_id in (select id from public.participants where event_code = v_event);

  delete from public.participant_recovery_attempts where event_code = v_event;
  delete from public.event_participant_bans where event_code = v_event;
  delete from public.game_tables where event_code = v_event;
  delete from public.drink_offers where event_code = v_event;

  -- Remaining participant-owned rows use ON DELETE CASCADE.
  delete from public.participants where event_code = v_event;

  return v_participant_count;
end;
$$;

revoke all on function public.admin_reset_event_participants(text) from public, anon, authenticated;
grant execute on function public.admin_reset_event_participants(text) to service_role;

comment on function public.admin_reset_event_participants(text) is
  'Deletes all participant runtime data for one event while preserving event configuration, missions and rewards.';

commit;
