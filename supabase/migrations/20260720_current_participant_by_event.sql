-- Resolve the participant owned by the authenticated user for one event.
-- Keeping the event code in the function avoids selecting an older profile
-- belonging to the same anonymous identity in a different event.
create or replace function public.current_participant_for_event(
  p_event_code text
)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.participants p
  where p.auth_user_id = auth.uid()
    and p.event_code = lower(trim(p_event_code))
  limit 1;
$$;

revoke all on function public.current_participant_for_event(text) from public;
grant execute on function public.current_participant_for_event(text)
  to authenticated;

