create or replace function public.block_and_report(
  p_match_id uuid,
  p_participant_id uuid,
  p_recovery_code text,
  p_reason text,
  p_details text default null,
  p_create_report boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_participant uuid;
begin
  if p_recovery_code is null or length(trim(p_recovery_code)) <> 8 then
    raise exception 'Invalid participant credentials';
  end if;

  if not exists (
    select 1 from public.participants
    where id = p_participant_id
      and recovery_code = upper(trim(p_recovery_code))
  ) then
    raise exception 'Invalid participant credentials';
  end if;

  select case
    when user_one = p_participant_id then user_two
    when user_two = p_participant_id then user_one
    else null
  end
  into v_other_participant
  from public.matches
  where id = p_match_id;

  if v_other_participant is null then
    raise exception 'Participant does not belong to this match';
  end if;

  insert into public.participant_blocks (
    match_id, blocked_by, blocked_participant, reason
  ) values (
    p_match_id,
    p_participant_id,
    v_other_participant,
    coalesce(nullif(trim(p_reason), ''), 'Blocco senza segnalazione')
  )
  on conflict (match_id, blocked_by)
  do update set
    blocked_participant = excluded.blocked_participant,
    reason = excluded.reason;

  if p_create_report and not exists (
    select 1 from public.reports
    where match_id = p_match_id
      and reported_by = p_participant_id
  ) then
    insert into public.reports (
      match_id, reported_by, reported_participant, reason, details
    ) values (
      p_match_id,
      p_participant_id,
      v_other_participant,
      coalesce(nullif(trim(p_reason), ''), 'Altro'),
      nullif(trim(p_details), '')
    );
  end if;

  update public.matches
  set status = 'blocked'
  where id = p_match_id;
end;
$$;

revoke all on function public.block_and_report(
  uuid, uuid, text, text, text, boolean
) from public;

grant execute on function public.block_and_report(
  uuid, uuid, text, text, text, boolean
) to anon, authenticated;
