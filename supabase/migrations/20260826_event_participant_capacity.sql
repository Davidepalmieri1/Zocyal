begin;

create or replace function public.enforce_event_participant_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text := lower(trim(new.event_code));
  v_participants integer;
begin
  if tg_op = 'UPDATE' and v_event = lower(trim(old.event_code)) then
    return new;
  end if;

  -- Serialize registrations for the same event so simultaneous requests can
  -- never both occupy the final available place.
  perform pg_advisory_xact_lock(
    hashtextextended('zocyal:event-capacity:' || v_event, 0)
  );

  select count(*)::integer
  into v_participants
  from public.participants participant
  where participant.event_code = v_event;

  if v_participants >= 190 then
    raise exception 'Event participant capacity reached'
      using errcode = 'P0001',
            detail = 'This event accepts a maximum of 190 participants.';
  end if;

  new.event_code := v_event;
  return new;
end;
$$;

drop trigger if exists participants_enforce_event_capacity on public.participants;
create trigger participants_enforce_event_capacity
before insert or update of event_code on public.participants
for each row execute function public.enforce_event_participant_capacity();

create or replace function public.get_event_registration_availability(
  p_event_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participants integer;
begin
  if not exists (select 1 from public.events event where event.code = v_event) then
    raise exception 'Invalid event';
  end if;

  select count(*)::integer
  into v_participants
  from public.participants participant
  where participant.event_code = v_event;

  return jsonb_build_object(
    'capacity', 190,
    'participants', v_participants,
    'remaining', greatest(190 - v_participants, 0),
    'available', v_participants < 190
  );
end;
$$;

revoke all on function public.enforce_event_participant_capacity() from public, anon, authenticated;
revoke all on function public.get_event_registration_availability(text) from public;
grant execute on function public.get_event_registration_availability(text) to anon, authenticated;

commit;
