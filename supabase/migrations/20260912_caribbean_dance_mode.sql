begin;

alter table public.events drop constraint if exists events_experience_mode_valid;
alter table public.events add constraint events_experience_mode_valid
  check (experience_mode in ('standard', 'inclusive', 'caribbean'));

create table public.participant_dance_profiles (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  role text not null check (role in ('leader', 'follower', 'both')),
  skills jsonb not null default '{}'::jsonb,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint dance_skills_object check (jsonb_typeof(skills) = 'object')
);

create table public.dance_invitations (
  id uuid primary key default gen_random_uuid(),
  event_code text not null references public.events(code) on delete cascade,
  sender_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  style text not null check (style in ('salsa_cubana','salsa_portoricana','bachata','bachata_sensual','merengue','kizomba','balli_di_gruppo')),
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','later','cancelled','expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  check (sender_id <> receiver_id),
  check (message is null or char_length(message) <= 120)
);

create unique index dance_one_pending_pair
  on public.dance_invitations(event_code, sender_id, receiver_id)
  where status = 'pending';
create index dance_invites_receiver_status on public.dance_invitations(receiver_id, status, created_at desc);

alter table public.participant_dance_profiles enable row level security;
alter table public.dance_invitations enable row level security;

create policy dance_profiles_event_read on public.participant_dance_profiles for select to authenticated
using (exists (
  select 1 from public.participants mine join public.participants other on other.id = participant_id
  join public.events event on event.code = mine.event_code
  where mine.auth_user_id = auth.uid() and mine.event_code = other.event_code and event.experience_mode = 'caribbean'
));
create policy dance_invites_party_read on public.dance_invitations for select to authenticated
using (exists (select 1 from public.participants p where p.auth_user_id = auth.uid() and p.id in (sender_id, receiver_id)));

create or replace function public.save_dance_profile(p_event_code text, p_role text, p_skills jsonb, p_available boolean default true)
returns public.participant_dance_profiles language plpgsql security definer set search_path = public as $$
declare v_participant uuid; v_skill text; v_level text;
begin
  select p.id into v_participant from participants p join events e on e.code=p.event_code
  where p.auth_user_id=auth.uid() and p.event_code=lower(trim(p_event_code)) and e.experience_mode='caribbean';
  if v_participant is null then raise exception 'Caribbean participant not found'; end if;
  if p_role not in ('leader','follower','both') or jsonb_typeof(p_skills) <> 'object' or not exists (select 1 from jsonb_object_keys(p_skills)) then
    raise exception 'Invalid dance profile';
  end if;
  for v_skill, v_level in select key, value #>> '{}' from jsonb_each(p_skills) loop
    if v_skill not in ('salsa_cubana','salsa_portoricana','bachata','bachata_sensual','merengue','kizomba','balli_di_gruppo')
      or v_level not in ('beginner','intermediate','advanced') then raise exception 'Invalid dance skill'; end if;
  end loop;
  insert into participant_dance_profiles(participant_id,role,skills,available,updated_at)
  values(v_participant,p_role,p_skills,p_available,now()) on conflict(participant_id) do update
  set role=excluded.role,skills=excluded.skills,available=excluded.available,updated_at=now();
  return (select d from participant_dance_profiles d where d.participant_id=v_participant);
end $$;

create or replace function public.send_dance_invitation(p_event_code text, p_receiver_id uuid, p_style text, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sender uuid; v_id uuid; v_sender_profile participant_dance_profiles; v_receiver_profile participant_dance_profiles;
begin
  select p.id into v_sender from participants p join events e on e.code=p.event_code
  where p.auth_user_id=auth.uid() and p.event_code=lower(trim(p_event_code)) and e.experience_mode='caribbean';
  select d.* into v_sender_profile from participant_dance_profiles d where d.participant_id=v_sender;
  select d.* into v_receiver_profile from participant_dance_profiles d join participants p on p.id=d.participant_id
  where d.participant_id=p_receiver_id and p.event_code=lower(trim(p_event_code));
  if v_sender is null or v_receiver_profile.participant_id is null or not v_sender_profile.available or not v_receiver_profile.available then raise exception 'Dancer unavailable'; end if;
  if not (v_sender_profile.skills ? p_style and v_receiver_profile.skills ? p_style) then raise exception 'Dance style not shared'; end if;
  if not (v_sender_profile.role='both' or v_receiver_profile.role='both' or v_sender_profile.role<>v_receiver_profile.role) then raise exception 'Dance roles not compatible'; end if;
  update dance_invitations set status='expired' where status='pending' and expires_at<=now();
  if exists(select 1 from dance_invitations where event_code=lower(trim(p_event_code)) and status='pending' and (sender_id=v_sender or receiver_id=v_sender)) then raise exception 'Active invitation exists'; end if;
  insert into dance_invitations(event_code,sender_id,receiver_id,style,message)
  values(lower(trim(p_event_code)),v_sender,p_receiver_id,p_style,nullif(left(trim(p_message),120),'')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_dance_invitation(p_invitation_id uuid, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare v_invite dance_invitations;
begin
  if p_response not in ('accepted','declined','later') then raise exception 'Invalid response'; end if;
  select i.* into v_invite from dance_invitations i join participants p on p.id=i.receiver_id
  where i.id=p_invitation_id and p.auth_user_id=auth.uid() and i.status='pending' and i.expires_at>now() for update;
  if v_invite.id is null then raise exception 'Invitation unavailable'; end if;
  update dance_invitations set status=p_response,responded_at=now() where id=p_invitation_id;
  if p_response='accepted' then update participant_dance_profiles set available=false,updated_at=now() where participant_id in (v_invite.sender_id,v_invite.receiver_id); end if;
end $$;

revoke all on function public.save_dance_profile(text,text,jsonb,boolean) from public;
revoke all on function public.send_dance_invitation(text,uuid,text,text) from public;
revoke all on function public.respond_dance_invitation(uuid,text) from public;
grant execute on function public.save_dance_profile(text,text,jsonb,boolean) to authenticated;
grant execute on function public.send_dance_invitation(text,uuid,text,text) to authenticated;
grant execute on function public.respond_dance_invitation(uuid,text) to authenticated;
grant select on public.participant_dance_profiles, public.dance_invitations to authenticated;

commit;
