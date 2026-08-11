alter table public.answers
  add column if not exists question_9 text,
  add column if not exists question_10 text,
  add column if not exists question_11 text,
  add column if not exists question_12 text;

-- I risultati del vecchio questionario non sono confrontabili con il nuovo.
-- Ogni partecipante lo completa nuovamente una sola volta.
update public.participants
set completed_test = false
where completed_test = true;
