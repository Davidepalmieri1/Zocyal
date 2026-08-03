begin;

create or replace function public.get_messages_for_match(p_match_id uuid)
returns setof public.messages
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1
    from public.matches matched
    join public.participants participant
      on participant.id in (matched.user_one, matched.user_two)
    where matched.id = p_match_id
      and participant.auth_user_id = auth.uid()
      and matched.status <> 'blocked'
  ) then
    raise exception 'Match access denied' using errcode = '42501';
  end if;

  return query
  select message.*
  from public.messages message
  where message.match_id = p_match_id
  order by message.created_at, message.id;
end;
$$;

revoke all on function public.get_messages_for_match(uuid) from public;
grant execute on function public.get_messages_for_match(uuid) to authenticated;

commit;
