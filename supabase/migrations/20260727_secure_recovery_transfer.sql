-- Secure profile recovery across devices.
--
-- A valid recovery code transfers ownership to the current authenticated
-- anonymous user, rotates the code in the same transaction, and therefore
-- removes the previous owner's effective RLS access immediately.

create table if not exists public.participant_recovery_attempts (
  auth_user_id uuid not null,
  event_code text not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  locked_until timestamptz,
  primary key (auth_user_id, event_code),
  constraint participant_recovery_attempts_count_valid
    check (attempt_count >= 0)
);

alter table public.participant_recovery_attempts enable row level security;

-- No browser role needs direct access. The security-definer recovery function
-- is the only writer and reader of this table.
revoke all on table public.participant_recovery_attempts
from public, anon, authenticated;

create or replace function public.claim_participant(
  p_event_code text,
  p_recovery_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_event_code text := lower(trim(p_event_code));
  v_recovery_code text := upper(trim(p_recovery_code));
  v_recovery_hash text;
  v_new_code text := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  v_id uuid;
  v_completed_test boolean;
  v_attempt public.participant_recovery_attempts%rowtype;
  v_now timestamptz := clock_timestamp();
  v_retry_after integer;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_event_code = ''
     or length(v_recovery_code) not in (8, 32)
     or v_recovery_code !~ '^[A-F0-9]+$' then
    return jsonb_build_object('error', 'invalid_credentials');
  end if;

  insert into public.participant_recovery_attempts (
    auth_user_id,
    event_code,
    window_started_at,
    attempt_count,
    locked_until
  )
  values (
    v_auth_user_id,
    v_event_code,
    v_now,
    0,
    null
  )
  on conflict (auth_user_id, event_code) do nothing;

  select *
  into v_attempt
  from public.participant_recovery_attempts
  where auth_user_id = v_auth_user_id
    and event_code = v_event_code
  for update;

  if v_attempt.locked_until is not null
     and v_attempt.locked_until > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_attempt.locked_until - v_now)))::integer
    );

    return jsonb_build_object(
      'error', 'rate_limited',
      'retry_after_seconds', v_retry_after
    );
  end if;

  if v_attempt.window_started_at <= v_now - interval '15 minutes' then
    update public.participant_recovery_attempts
    set window_started_at = v_now,
        attempt_count = 0,
        locked_until = null
    where auth_user_id = v_auth_user_id
      and event_code = v_event_code;

    v_attempt.attempt_count := 0;
  end if;

  if v_attempt.attempt_count >= 5 then
    update public.participant_recovery_attempts
    set locked_until = v_now + interval '15 minutes'
    where auth_user_id = v_auth_user_id
      and event_code = v_event_code;

    return jsonb_build_object(
      'error', 'rate_limited',
      'retry_after_seconds', 900
    );
  end if;

  update public.participant_recovery_attempts
  set attempt_count = attempt_count + 1
  where auth_user_id = v_auth_user_id
    and event_code = v_event_code;

  v_recovery_hash := encode(
    extensions.digest(v_recovery_code, 'sha256'),
    'hex'
  );

  select p.id, p.completed_test
  into v_id, v_completed_test
  from public.participants p
  where p.event_code = v_event_code
    and p.recovery_code_hash = v_recovery_hash
  for update;

  if v_id is null then
    update public.participant_recovery_attempts
    set locked_until = case
      when attempt_count >= 5 then v_now + interval '15 minutes'
      else null
    end
    where auth_user_id = v_auth_user_id
      and event_code = v_event_code;

    return jsonb_build_object('error', 'invalid_credentials');
  end if;

  if exists (
    select 1
    from public.participants p
    where p.auth_user_id = v_auth_user_id
      and p.event_code = v_event_code
      and p.id <> v_id
  ) then
    return jsonb_build_object('error', 'account_has_participant');
  end if;

  update public.participants
  set auth_user_id = v_auth_user_id,
      recovery_code = null,
      recovery_code_hash = encode(
        extensions.digest(v_new_code, 'sha256'),
        'hex'
      )
  where id = v_id;

  delete from public.participant_recovery_attempts
  where auth_user_id = v_auth_user_id
    and event_code = v_event_code;

  return jsonb_build_object(
    'participant_id', v_id,
    'recovery_code', v_new_code,
    'completed_test', coalesce(v_completed_test, false)
  );
end;
$function$;

revoke all on function public.claim_participant(text, text) from public;
grant execute on function public.claim_participant(text, text)
to authenticated;

comment on function public.claim_participant(text, text) is
  'Transfers a participant to the authenticated user using a one-time recovery code, rotates the code atomically, and rate-limits failed attempts.';
