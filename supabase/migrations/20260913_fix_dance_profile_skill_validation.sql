begin;

create or replace function public.save_dance_profile(
  p_event_code text,
  p_role text,
  p_skills jsonb,
  p_available boolean default true
)
returns public.participant_dance_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid;
  v_skill text;
  v_level text;
begin
  select p.id into v_participant
  from participants p
  join events e on e.code = p.event_code
  where p.auth_user_id = auth.uid()
    and p.event_code = lower(trim(p_event_code))
    and e.experience_mode = 'caribbean';

  if v_participant is null then
    raise exception 'Caribbean participant not found';
  end if;

  if p_role not in ('leader', 'follower', 'both')
    or jsonb_typeof(p_skills) <> 'object'
    or not exists (select 1 from jsonb_object_keys(p_skills)) then
    raise exception 'Invalid dance profile';
  end if;

  for v_skill, v_level in
    select key, value #>> '{}'
    from jsonb_each(p_skills)
  loop
    if v_skill not in (
      'salsa_cubana',
      'salsa_portoricana',
      'bachata',
      'bachata_sensual',
      'merengue',
      'kizomba',
      'balli_di_gruppo'
    ) or v_level not in ('beginner', 'intermediate', 'advanced') then
      raise exception 'Invalid dance skill';
    end if;
  end loop;

  insert into participant_dance_profiles (
    participant_id,
    role,
    skills,
    available,
    updated_at
  ) values (
    v_participant,
    p_role,
    p_skills,
    p_available,
    now()
  )
  on conflict (participant_id) do update
  set role = excluded.role,
      skills = excluded.skills,
      available = excluded.available,
      updated_at = now();

  return (
    select profile
    from participant_dance_profiles profile
    where profile.participant_id = v_participant
  );
end;
$$;

commit;
