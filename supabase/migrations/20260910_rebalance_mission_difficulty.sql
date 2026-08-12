begin;

update public.missions
set difficulty = case
  when verification_key in (
    'profile_completed',
    'questionnaire_completed',
    'matches_created'
  ) then 'easy'
  when lower(trim(title)) = 'ottieni il tuo primo match' then 'easy'
  when points <= 70 then 'medium'
  else 'special'
end;

commit;
