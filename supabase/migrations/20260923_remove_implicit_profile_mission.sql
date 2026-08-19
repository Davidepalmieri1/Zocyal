begin;

-- Profile completion must award points only when an administrator explicitly
-- creates a mission. The legacy trigger created its own hidden default mission
-- and therefore changed every new event without an administrator action.
drop trigger if exists participants_award_profile_completion
on public.participants;

drop function if exists public.award_profile_completion_points();

-- Remove only the untouched legacy default. Admin-created missions use a
-- generated code, and edited legacy missions no longer match this full
-- signature, so intentional event configuration is preserved.
delete from public.missions
where code = 'profile-completed'
  and title = 'Completa il profilo ZOCYAL'
  and description = 'Completa il profilo e il questionario della serata.'
  and points = 10
  and verification_mode = 'automatic'
  and verification_key = 'profile_completed';

commit;
