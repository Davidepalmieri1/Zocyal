begin;

-- Legacy helpers cannot infer an event when one authenticated browser owns
-- profiles in more than one event. They now return an identity only for a
-- genuinely single-profile account instead of silently selecting an arbitrary
-- participant. Event-aware and resource-aware RPCs remain the supported path.
create or replace function public.mr_current_participant_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when count(*) = 1 then (array_agg(participant.id))[1]
    else null
  end
  from public.participants participant
  where participant.auth_user_id = auth.uid();
$$;

create or replace function public.mr_current_event_code()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select case when count(*) = 1 then min(participant.event_code) else null end
  from public.participants participant
  where participant.auth_user_id = auth.uid();
$$;

revoke all on function public.mr_current_participant_id() from public;
revoke all on function public.mr_current_event_code() from public;
grant execute on function public.mr_current_participant_id() to authenticated;
grant execute on function public.mr_current_event_code() to authenticated;

commit;
