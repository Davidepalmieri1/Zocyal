begin;

-- Inclusive events keep identity preferences private and use them only to
-- prioritize suggestions. They no longer prevent profile discovery or likes.
create or replace function public.inclusive_pair_allowed(
  p_one uuid,
  p_two uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.participants one_participant
    join public.participants two_participant
      on two_participant.id = p_two
     and two_participant.event_code = one_participant.event_code
    where one_participant.id = p_one
      and p_one <> p_two
  );
$$;

create or replace function public.get_interest_suggestions(
  p_target_participants uuid[]
)
returns table (
  participant_id uuid,
  preference_priority boolean
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
      when mine.experience_mode <> 'inclusive' then false
      else
        coalesce(my_preferences.matching_consent, false)
        and coalesce(target_preferences.matching_consent, false)
        and my_preferences.identity_category is not null
        and target_preferences.identity_category is not null
        and target_preferences.identity_category = any(coalesce(
          my_preferences.connection_preferences,
          '{}'::text[]
        ))
        and my_preferences.identity_category = any(coalesce(
          target_preferences.connection_preferences,
          '{}'::text[]
        ))
    end as preference_priority
  from mine
  join public.participants target
    on target.event_code = mine.event_code
  join requested on requested.target_id = target.id
  left join public.participant_inclusive_preferences my_preferences
    on my_preferences.participant_id = mine.id
  left join public.participant_inclusive_preferences target_preferences
    on target_preferences.participant_id = target.id
  where target.id <> mine.id;
$$;

create or replace function public.send_interest(p_to_participant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_from uuid;
  v_match_id uuid;
  v_mutual boolean := false;
begin
  select participant.id
  into v_from
  from public.participants participant
  join public.participants target
    on target.id = p_to_participant
   and target.event_code = participant.event_code
  where participant.auth_user_id = auth.uid()
  limit 1;

  if v_from is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  if p_to_participant = v_from then
    raise exception 'Invalid interest target' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.participant_blocks block
    where (block.blocked_by = v_from and block.blocked_participant = p_to_participant)
       or (block.blocked_by = p_to_participant and block.blocked_participant = v_from)
  ) then
    raise exception 'Interaction unavailable';
  end if;

  insert into public.likes (from_participant, to_participant)
  values (v_from, p_to_participant)
  on conflict do nothing;

  select exists (
    select 1
    from public.likes interest
    where interest.from_participant = p_to_participant
      and interest.to_participant = v_from
  ) into v_mutual;

  if v_mutual then
    perform pg_advisory_xact_lock(
      hashtextextended(
        least(v_from::text, p_to_participant::text)
        || ':' ||
        greatest(v_from::text, p_to_participant::text),
        0
      )
    );

    select existing_match.id
    into v_match_id
    from public.matches existing_match
    where (existing_match.user_one = v_from and existing_match.user_two = p_to_participant)
       or (existing_match.user_one = p_to_participant and existing_match.user_two = v_from)
    limit 1;

    if v_match_id is null then
      insert into public.matches (user_one, user_two, status)
      values (v_from, p_to_participant, 'matched')
      returning id into v_match_id;
    end if;
  end if;

  return jsonb_build_object(
    'mutual', v_mutual,
    'match_id', v_match_id
  );
end;
$$;

revoke all on function public.inclusive_pair_allowed(uuid, uuid) from public;
revoke all on function public.get_interest_suggestions(uuid[]) from public;
revoke all on function public.send_interest(uuid) from public;

grant execute on function public.get_interest_suggestions(uuid[]) to authenticated;
grant execute on function public.send_interest(uuid) to authenticated;

commit;
