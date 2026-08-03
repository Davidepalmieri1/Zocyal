begin;

create or replace function public.get_unread_notification_messages(p_event_code text)
returns table (
  id uuid,
  match_id uuid,
  message text,
  sender_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_event text := lower(trim(p_event_code));
  v_participant uuid;
begin
  v_participant := public.current_participant_for_event(v_event);
  if v_participant is null then return; end if;

  return query
  select msg.id, msg.match_id, msg.message, msg.sender_id, msg.created_at
  from public.messages msg
  join public.matches connection on connection.id = msg.match_id
  where (connection.user_one = v_participant or connection.user_two = v_participant)
    and msg.sender_id <> v_participant
    and msg.read_at is null
  order by msg.created_at desc
  limit 20;
end;
$$;

revoke all on function public.get_unread_notification_messages(text) from public, anon;
grant execute on function public.get_unread_notification_messages(text) to authenticated;

commit;
