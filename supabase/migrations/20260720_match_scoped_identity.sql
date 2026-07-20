-- Resolve participant identity from the match or offer being acted on.
-- This prevents an account with profiles in multiple events from using an
-- unrelated participant as message sender or drink-offer actor.

create or replace function public.create_message(
  p_match_id uuid,
  p_message text
)
returns public.messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid;
  v_result public.messages;
begin
  select p.id into v_me
  from public.matches m
  join public.participants p on p.id in (m.user_one, m.user_two)
  where m.id = p_match_id
    and p.auth_user_id = auth.uid()
  limit 1;

  if v_me is null
     or not public.can_access_match(p_match_id)
     or public.match_is_blocked(p_match_id) then
    raise exception 'Match access denied' using errcode = '42501';
  end if;

  if nullif(trim(p_message), '') is null
     or length(trim(p_message)) > 2000 then
    raise exception 'Invalid message';
  end if;

  insert into public.messages (match_id, sender_id, message)
  values (p_match_id, v_me, trim(p_message))
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.send_drink_offer(p_match_id uuid)
returns public.drink_offers
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid;
  v_match public.matches;
  v_receiver uuid;
  v_result public.drink_offers;
begin
  select * into v_match
  from public.matches
  where id = p_match_id;

  select p.id into v_me
  from public.participants p
  where p.auth_user_id = auth.uid()
    and p.id in (v_match.user_one, v_match.user_two)
  limit 1;

  if v_me is null
     or not found
     or v_match.status = 'blocked'
     or not public.can_access_match(p_match_id) then
    raise exception 'Match unavailable' using errcode = '42501';
  end if;

  v_receiver := case
    when v_match.user_one = v_me then v_match.user_two
    else v_match.user_one
  end;

  insert into public.drink_offers (
    event_code, match_id, sender_id, receiver_id
  )
  select p.event_code, p_match_id, v_me, v_receiver
  from public.participants p
  join public.events e on e.code = p.event_code
  where p.id = v_me
    and e.status = 'open'
    and (e.starts_at is null or e.starts_at <= now())
    and (e.ends_at is null or e.ends_at > now())
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;

  return v_result;
exception
  when unique_violation then
    raise exception 'Drink offer already sent' using errcode = '23505';
end;
$$;

create or replace function public.respond_drink_offer(
  p_offer_id uuid,
  p_accept boolean
)
returns public.drink_offers
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid;
  v_result public.drink_offers;
begin
  select o.receiver_id into v_me
  from public.drink_offers o
  join public.participants p on p.id = o.receiver_id
  where o.id = p_offer_id
    and p.auth_user_id = auth.uid();

  update public.drink_offers
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_offer_id
    and receiver_id = v_me
    and status = 'pending'
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Offer unavailable' using errcode = '42501';
  end if;

  if p_accept then
    insert into public.drink_coupons (offer_id, owner_id)
    values (v_result.id, v_result.sender_id)
    on conflict (offer_id) do nothing;
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_message(uuid, text) from public;
revoke all on function public.send_drink_offer(uuid) from public;
revoke all on function public.respond_drink_offer(uuid, boolean) from public;

grant execute on function public.create_message(uuid, text) to authenticated;
grant execute on function public.send_drink_offer(uuid) to authenticated;
grant execute on function public.respond_drink_offer(uuid, boolean)
  to authenticated;

