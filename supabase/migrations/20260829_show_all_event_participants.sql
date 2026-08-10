-- Participant discovery must include everyone in the same event. Inclusive
-- matching restrictions remain enforced by send_interest/inclusive_pair_allowed.
create or replace function public.shares_participant_event(
  p_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.participants mine
    join public.participants other
      on other.event_code = mine.event_code
     and other.id = p_participant_id
    where mine.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.shares_participant_event(uuid) from public;
grant execute on function public.shares_participant_event(uuid) to authenticated;
