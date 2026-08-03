begin;

create unique index if not exists participants_event_nickname_uidx
  on public.participants (event_code, lower(btrim(nickname)));

comment on index public.participants_event_nickname_uidx is
  'Prevents duplicate participant nicknames within the same event, case-insensitively.';

commit;
