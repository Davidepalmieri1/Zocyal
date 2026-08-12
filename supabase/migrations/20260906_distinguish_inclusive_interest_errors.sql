begin;

-- Keep the privacy gate strict, but distinguish an incomplete sender setup
-- from a target whose private choices are not mutually compatible. The client
-- must never infer or expose which private choice made a pair unavailable.
create or replace function public.send_interest(p_to_participant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_from uuid;
  v_event text;
  v_experience_mode text;
  v_sender_complete boolean := true;
  v_match_id uuid;
  v_mutual boolean := false;
begin
  select p.id, p.event_code, event.experience_mode
  into v_from, v_event, v_experience_mode
  from public.participants p
  join public.participants target
    on target.id = p_to_participant
   and target.event_code = p.event_code
  join public.events event
    on event.code = p.event_code
  where p.auth_user_id = auth.uid()
  limit 1;

  if v_from is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  if p_to_participant = v_from then
    raise exception 'Invalid interest target' using errcode = '22023';
  end if;

  if v_experience_mode = 'inclusive' then
    select
      coalesce(preferences.matching_consent, false)
      and preferences.identity_category is not null
      and cardinality(coalesce(
        preferences.connection_preferences,
        '{}'::text[]
      )) > 0
    into v_sender_complete
    from public.participant_inclusive_preferences preferences
    where preferences.participant_id = v_from;

    if not coalesce(v_sender_complete, false) then
      raise exception 'Inclusive matching setup incomplete'
        using errcode = '42501';
    end if;

    if not public.inclusive_pair_allowed(v_from, p_to_participant) then
      raise exception 'Inclusive pair unavailable'
        using errcode = '42501';
    end if;
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

    select m.id
    into v_match_id
    from public.matches m
    where (m.user_one = v_from and m.user_two = p_to_participant)
       or (m.user_one = p_to_participant and m.user_two = v_from)
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

revoke all on function public.send_interest(uuid) from public;
grant execute on function public.send_interest(uuid) to authenticated;

commit;
