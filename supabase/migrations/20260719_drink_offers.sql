create table if not exists public.drink_offers (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  status text not null default 'pending',
  discount_cents integer not null default 200,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  redeemed_at timestamptz,
  constraint drink_offers_direction_unique unique (match_id, sender_id, receiver_id),
  constraint drink_offers_status_valid check (status in ('pending','accepted','declined','redeemed')),
  constraint drink_offers_discount_valid check (discount_cents = 200),
  constraint drink_offers_people_different check (sender_id <> receiver_id)
);

create table if not exists public.drink_coupons (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.drink_offers(id) on delete cascade,
  owner_id uuid not null references public.participants(id) on delete cascade,
  coupon_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create index if not exists drink_offers_event_status_idx on public.drink_offers(event_code,status);
create index if not exists drink_offers_receiver_idx on public.drink_offers(receiver_id,created_at desc);

alter table public.drink_offers enable row level security;
alter table public.drink_coupons enable row level security;
drop policy if exists drink_offers_match_members_read on public.drink_offers;
create policy drink_offers_match_members_read on public.drink_offers
for select to authenticated using (public.can_access_match(match_id));
drop policy if exists drink_coupons_owner_read on public.drink_coupons;
create policy drink_coupons_owner_read on public.drink_coupons
for select to authenticated using (public.owns_participant(owner_id));

create or replace function public.send_drink_offer(p_match_id uuid)
returns public.drink_offers
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := public.mr_current_participant_id(); v_match public.matches; v_receiver uuid; v_result public.drink_offers;
begin
  if v_me is null then raise exception 'Participant authentication required' using errcode='28000'; end if;
  select * into v_match from public.matches where id=p_match_id;
  if not found or v_match.status='blocked' or not public.can_access_match(p_match_id) then raise exception 'Match unavailable' using errcode='42501'; end if;
  v_receiver := case when v_match.user_one=v_me then v_match.user_two when v_match.user_two=v_me then v_match.user_one end;
  if v_receiver is null then raise exception 'Match unavailable' using errcode='42501'; end if;
  insert into public.drink_offers(event_code,match_id,sender_id,receiver_id)
  select p.event_code,p_match_id,v_me,v_receiver from public.participants p
  join public.events e on e.code=p.event_code
  where p.id=v_me and e.status='open'
    and (e.starts_at is null or e.starts_at<=now())
    and (e.ends_at is null or e.ends_at>now())
  returning * into v_result;
  if v_result.id is null then raise exception 'Event unavailable' using errcode='42501'; end if;
  return v_result;
exception when unique_violation then
  raise exception 'Drink offer already sent' using errcode='23505';
end;
$$;

create or replace function public.respond_drink_offer(p_offer_id uuid,p_accept boolean)
returns public.drink_offers
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := public.mr_current_participant_id(); v_result public.drink_offers;
begin
  update public.drink_offers set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()
  where id=p_offer_id and receiver_id=v_me and status='pending' returning * into v_result;
  if v_result.id is null then raise exception 'Offer unavailable' using errcode='42501'; end if;
  if p_accept then insert into public.drink_coupons(offer_id,owner_id) values(v_result.id,v_result.sender_id) on conflict(offer_id) do nothing; end if;
  return v_result;
end;
$$;

revoke all on table public.drink_offers from public,anon,authenticated;
revoke all on table public.drink_coupons from public,anon,authenticated;
grant select on table public.drink_offers to authenticated;
grant select on table public.drink_coupons to authenticated;
revoke all on function public.send_drink_offer(uuid) from public;
revoke all on function public.respond_drink_offer(uuid,boolean) from public;
grant execute on function public.send_drink_offer(uuid) to authenticated;
grant execute on function public.respond_drink_offer(uuid,boolean) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='drink_offers') then
    alter publication supabase_realtime add table public.drink_offers;
  end if;
end $$;
