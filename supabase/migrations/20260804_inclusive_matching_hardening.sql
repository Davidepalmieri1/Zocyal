begin;

-- These RPCs already validate auth.uid(), but removing anon execution makes
-- the public API surface deny-by-default as well.
revoke execute on function public.get_inclusive_matching_settings(text)
  from public, anon;
revoke execute on function public.save_inclusive_matching_settings(
  text, text, text, text[], boolean
) from public, anon;
revoke execute on function public.create_inclusive_participant(
  text, text, integer, text, text, text, text, text[], boolean
) from public, anon;
revoke execute on function public.send_interest(uuid)
  from public, anon;

grant execute on function public.get_inclusive_matching_settings(text)
  to authenticated;
grant execute on function public.save_inclusive_matching_settings(
  text, text, text, text[], boolean
) to authenticated;
grant execute on function public.create_inclusive_participant(
  text, text, integer, text, text, text, text, text[], boolean
) to authenticated;
grant execute on function public.send_interest(uuid)
  to authenticated;

-- The RPC already serializes mutual interests with an advisory lock. This
-- database invariant also prevents a reversed duplicate from trusted clients.
create unique index if not exists matches_unordered_pair_uidx
  on public.matches (
    least(user_one, user_two),
    greatest(user_one, user_two)
  );

commit;
