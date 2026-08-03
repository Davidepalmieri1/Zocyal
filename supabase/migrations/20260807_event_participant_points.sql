begin;

create or replace function public.get_participant_points_for_event(
  p_event_code text
)
returns integer
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid;
begin
  v_participant := public.current_participant_for_event(p_event_code);

  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  return public.mr_points_available(v_participant);
end;
$$;

revoke all on function public.get_participant_points_for_event(text) from public;
grant execute on function public.get_participant_points_for_event(text)
to authenticated;

commit;
