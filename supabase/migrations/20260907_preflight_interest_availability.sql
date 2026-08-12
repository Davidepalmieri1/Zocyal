begin;

create or replace function public.get_interest_availability(
  p_target_participants uuid[]
)
returns table (
  participant_id uuid,
  availability text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with mine as (
    select participant.id, participant.event_code, event.experience_mode
    from public.participants participant
    join public.events event on event.code = participant.event_code
    where participant.auth_user_id = auth.uid()
  ),
  requested as (
    select distinct target_id
    from unnest(coalesce(p_target_participants, '{}'::uuid[]))
      as requested_target(target_id)
    limit 50
  )
  select
    target.id as participant_id,
    case
      when mine.experience_mode = 'standard' then 'available'
      when not (
        coalesce(my_preferences.matching_consent, false)
        and my_preferences.identity_category is not null
        and cardinality(coalesce(
          my_preferences.connection_preferences,
          '{}'::text[]
        )) > 0
      ) then 'setup_required'
      when exists (
        select 1
        from public.participant_blocks block
        where (block.blocked_by = mine.id and block.blocked_participant = target.id)
           or (block.blocked_by = target.id and block.blocked_participant = mine.id)
      ) then 'unavailable'
      when public.inclusive_pair_allowed(mine.id, target.id) then 'available'
      else 'unavailable'
    end as availability
  from mine
  join public.participants target
    on target.event_code = mine.event_code
  join requested on requested.target_id = target.id
  left join public.participant_inclusive_preferences my_preferences
    on my_preferences.participant_id = mine.id
  where target.id <> mine.id;
$$;

revoke all on function public.get_interest_availability(uuid[]) from public;
grant execute on function public.get_interest_availability(uuid[]) to authenticated;

commit;
