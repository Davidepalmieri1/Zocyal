-- Resolve the acting participant inside the match being blocked. An anonymous
-- account can own profiles in multiple events, so selecting only by auth.uid()
-- can pick an unrelated profile and reject an otherwise valid block.

create or replace function public.block_report(
  p_match_id uuid,
  p_reason text,
  p_details text default null,
  p_create_report boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid;
  v_other uuid;
begin
  select
    participant.id,
    case
      when matched.user_one = participant.id then matched.user_two
      else matched.user_one
    end
  into v_me, v_other
  from public.matches matched
  join public.participants participant
    on participant.id in (matched.user_one, matched.user_two)
  where matched.id = p_match_id
    and participant.auth_user_id = auth.uid()
  limit 1;

  if v_me is null or v_other is null then
    raise exception 'Match access denied' using errcode = '42501';
  end if;

  insert into public.participant_blocks (
    match_id, blocked_by, blocked_participant, reason
  ) values (
    p_match_id, v_me, v_other,
    coalesce(nullif(trim(p_reason), ''), 'Blocco senza segnalazione')
  )
  on conflict (match_id, blocked_by) do update
  set blocked_participant = excluded.blocked_participant,
      reason = excluded.reason;

  if p_create_report then
    insert into public.reports (
      match_id, reported_by, reported_participant, reason, details
    )
    select
      p_match_id,
      v_me,
      v_other,
      coalesce(nullif(trim(p_reason), ''), 'Altro'),
      left(nullif(trim(p_details), ''), 2000)
    where not exists (
      select 1
      from public.reports report
      where report.match_id = p_match_id
        and report.reported_by = v_me
    );
  end if;

  update public.matches
  set status = 'blocked'
  where id = p_match_id;
end;
$$;

revoke all on function public.block_report(uuid, text, text, boolean)
from public;

grant execute on function public.block_report(uuid, text, text, boolean)
to authenticated;
