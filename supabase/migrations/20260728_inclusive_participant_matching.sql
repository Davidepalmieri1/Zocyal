begin;

create table if not exists public.participant_inclusive_preferences (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  identity_category text,
  pronouns text,
  connection_preferences text[] not null default '{}'::text[],
  matching_consent boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint inclusive_identity_valid check (
    identity_category is null
    or identity_category in ('woman', 'man', 'non_binary', 'other')
  ),
  constraint inclusive_pronouns_length check (
    pronouns is null or char_length(pronouns) <= 40
  ),
  constraint inclusive_preferences_valid check (
    connection_preferences <@ array['woman', 'man', 'non_binary', 'other']::text[]
  ),
  constraint inclusive_consent_data_valid check (
    matching_consent
    or (
      identity_category is null
      and pronouns is null
      and cardinality(connection_preferences) = 0
      and consented_at is null
    )
  )
);

alter table public.participant_inclusive_preferences enable row level security;

drop policy if exists inclusive_preferences_owner_read
  on public.participant_inclusive_preferences;
create policy inclusive_preferences_owner_read
on public.participant_inclusive_preferences
for select to authenticated
using (
  exists (
    select 1
    from public.participants p
    where p.id = participant_id
      and p.auth_user_id = auth.uid()
  )
);

revoke all on table public.participant_inclusive_preferences
  from public, anon, authenticated;
grant select on table public.participant_inclusive_preferences
  to authenticated;

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
    join public.events event
      on event.code = one_participant.event_code
    left join public.participant_inclusive_preferences one_preferences
      on one_preferences.participant_id = one_participant.id
    left join public.participant_inclusive_preferences two_preferences
      on two_preferences.participant_id = two_participant.id
    where one_participant.id = p_one
      and p_one <> p_two
      and (
        event.experience_mode = 'standard'
        or (
          event.experience_mode = 'inclusive'
          and one_preferences.matching_consent
          and two_preferences.matching_consent
          and one_preferences.identity_category is not null
          and two_preferences.identity_category is not null
          and cardinality(one_preferences.connection_preferences) > 0
          and cardinality(two_preferences.connection_preferences) > 0
          and two_preferences.identity_category =
            any(one_preferences.connection_preferences)
          and one_preferences.identity_category =
            any(two_preferences.connection_preferences)
        )
      )
  );
$$;

revoke all on function public.inclusive_pair_allowed(uuid, uuid) from public;

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
    join public.events event
      on event.code = mine.event_code
    where mine.auth_user_id = auth.uid()
      and (
        event.experience_mode = 'standard'
        or mine.id = other.id
        or public.inclusive_pair_allowed(mine.id, other.id)
        or exists (
          select 1
          from public.matches m
          where (m.user_one = mine.id and m.user_two = other.id)
             or (m.user_one = other.id and m.user_two = mine.id)
        )
      )
  );
$$;

create or replace function public.get_inclusive_matching_settings(
  p_event_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid;
  v_mode text;
  v_settings public.participant_inclusive_preferences;
begin
  select p.id, e.experience_mode
  into v_participant, v_mode
  from public.participants p
  join public.events e on e.code = p.event_code
  where p.auth_user_id = auth.uid()
    and p.event_code = lower(trim(p_event_code))
  limit 1;

  if v_participant is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  if v_mode <> 'inclusive' then
    return jsonb_build_object(
      'inclusive', false,
      'complete', true
    );
  end if;

  select *
  into v_settings
  from public.participant_inclusive_preferences
  where participant_id = v_participant;

  return jsonb_build_object(
    'inclusive', true,
    'identity_category', v_settings.identity_category,
    'pronouns', v_settings.pronouns,
    'connection_preferences',
      coalesce(v_settings.connection_preferences, '{}'::text[]),
    'consent', coalesce(v_settings.matching_consent, false),
    'complete',
      coalesce(v_settings.matching_consent, false)
      and v_settings.identity_category is not null
      and cardinality(coalesce(
        v_settings.connection_preferences,
        '{}'::text[]
      )) > 0
  );
end;
$$;

create or replace function public.save_inclusive_matching_settings(
  p_event_code text,
  p_identity_category text,
  p_pronouns text,
  p_connection_preferences text[],
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_participant uuid;
  v_identity text := nullif(trim(p_identity_category), '');
  v_pronouns text := nullif(trim(p_pronouns), '');
  v_preferences text[] := coalesce(p_connection_preferences, '{}'::text[]);
begin
  select p.id
  into v_participant
  from public.participants p
  join public.events e
    on e.code = p.event_code
   and e.experience_mode = 'inclusive'
  where p.auth_user_id = auth.uid()
    and p.event_code = lower(trim(p_event_code))
  limit 1;

  if v_participant is null then
    raise exception 'Inclusive participant not found' using errcode = '42501';
  end if;

  if v_identity is not null
     and v_identity not in ('woman', 'man', 'non_binary', 'other') then
    raise exception 'Invalid identity category';
  end if;

  if char_length(coalesce(v_pronouns, '')) > 40
     or not (
       v_preferences
       <@ array['woman', 'man', 'non_binary', 'other']::text[]
     ) then
    raise exception 'Invalid inclusive preferences';
  end if;

  select coalesce(array_agg(distinct value order by value), '{}'::text[])
  into v_preferences
  from unnest(v_preferences) value;

  if not coalesce(p_consent, false) then
    v_identity := null;
    v_pronouns := null;
    v_preferences := '{}'::text[];
  end if;

  insert into public.participant_inclusive_preferences (
    participant_id,
    identity_category,
    pronouns,
    connection_preferences,
    matching_consent,
    consented_at,
    updated_at
  ) values (
    v_participant,
    v_identity,
    v_pronouns,
    v_preferences,
    coalesce(p_consent, false),
    case when coalesce(p_consent, false) then now() else null end,
    now()
  )
  on conflict (participant_id) do update
  set identity_category = excluded.identity_category,
      pronouns = excluded.pronouns,
      connection_preferences = excluded.connection_preferences,
      matching_consent = excluded.matching_consent,
      consented_at = case
        when excluded.matching_consent
          then coalesce(
            public.participant_inclusive_preferences.consented_at,
            excluded.consented_at
          )
        else null
      end,
      updated_at = now();

  return public.get_inclusive_matching_settings(p_event_code);
end;
$$;

create or replace function public.create_inclusive_participant(
  p_event_code text,
  p_nickname text,
  p_age integer,
  p_goal text,
  p_avatar_url text,
  p_identity_category text,
  p_pronouns text,
  p_connection_preferences text[],
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.events e
    where e.code = lower(trim(p_event_code))
      and e.experience_mode = 'inclusive'
  ) then
    raise exception 'Inclusive event required';
  end if;

  v_result := public.create_participant(
    p_event_code,
    p_nickname,
    p_age,
    'Non pubblico',
    p_goal,
    p_avatar_url
  );

  perform public.save_inclusive_matching_settings(
    p_event_code,
    p_identity_category,
    p_pronouns,
    p_connection_preferences,
    p_consent
  );

  return v_result;
end;
$$;

create or replace function public.send_interest(p_to_participant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_from uuid;
  v_event text;
  v_match_id uuid;
  v_mutual boolean := false;
begin
  select p.id, p.event_code
  into v_from, v_event
  from public.participants p
  join public.participants target
    on target.id = p_to_participant
   and target.event_code = p.event_code
  where p.auth_user_id = auth.uid()
  limit 1;

  if v_from is null then
    raise exception 'Participant authentication required' using errcode = '28000';
  end if;

  if p_to_participant = v_from
     or not public.inclusive_pair_allowed(v_from, p_to_participant) then
    raise exception 'Inclusive matching preferences required'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.participant_blocks b
    where (b.blocked_by = v_from and b.blocked_participant = p_to_participant)
       or (b.blocked_by = p_to_participant and b.blocked_participant = v_from)
  ) then
    raise exception 'Interaction unavailable';
  end if;

  insert into public.likes (from_participant, to_participant)
  values (v_from, p_to_participant)
  on conflict do nothing;

  select exists (
    select 1
    from public.likes l
    where l.from_participant = p_to_participant
      and l.to_participant = v_from
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

revoke insert on table public.likes, public.matches from authenticated;
grant select on table public.likes, public.matches to authenticated;

revoke all on function public.get_inclusive_matching_settings(text) from public;
revoke all on function public.save_inclusive_matching_settings(
  text, text, text, text[], boolean
) from public;
revoke all on function public.create_inclusive_participant(
  text, text, integer, text, text, text, text, text[], boolean
) from public;
revoke all on function public.send_interest(uuid) from public;

grant execute on function public.get_inclusive_matching_settings(text)
  to authenticated;
grant execute on function public.save_inclusive_matching_settings(
  text, text, text, text[], boolean
) to authenticated;
grant execute on function public.create_inclusive_participant(
  text, text, integer, text, text, text, text, text[], boolean
) to authenticated;
grant execute on function public.send_interest(uuid) to authenticated;

comment on table public.participant_inclusive_preferences is
  'Private, owner-only event matching settings. Not exposed to staff dashboards.';

commit;
