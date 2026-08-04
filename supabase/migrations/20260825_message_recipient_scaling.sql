begin;

alter table public.messages
  add column if not exists receiver_id uuid references public.participants(id) on delete cascade;

update public.messages message
set receiver_id = case
  when matched.user_one = message.sender_id then matched.user_two
  else matched.user_one
end
from public.matches matched
where matched.id = message.match_id
  and message.receiver_id is null;

create or replace function public.set_message_receiver()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_one uuid;
  v_user_two uuid;
begin
  select matched.user_one, matched.user_two
  into v_user_one, v_user_two
  from public.matches matched
  where matched.id = new.match_id;

  if not found or new.sender_id not in (v_user_one, v_user_two) then
    raise exception 'Message sender is not part of this match'
      using errcode = '23514';
  end if;

  new.receiver_id := case
    when new.sender_id = v_user_one then v_user_two
    else v_user_one
  end;
  return new;
end;
$$;

drop trigger if exists messages_set_receiver on public.messages;
create trigger messages_set_receiver
before insert or update of match_id, sender_id on public.messages
for each row execute function public.set_message_receiver();

alter table public.messages
  alter column receiver_id set not null;

create index if not exists messages_receiver_created_idx
  on public.messages(receiver_id, created_at desc);

revoke all on function public.set_message_receiver() from public, anon, authenticated;

commit;
