import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  "supabase/migrations/20260923_remove_implicit_profile_mission.sql",
  "utf8"
)

assert.match(migration, /drop trigger if exists participants_award_profile_completion/)
assert.match(migration, /drop function if exists public\.award_profile_completion_points\(\)/)
assert.match(migration, /code = 'profile-completed'/)
assert.match(migration, /title = 'Completa il profilo ZOCYAL'/)
assert.match(migration, /points = 10/)
assert.match(migration, /verification_key = 'profile_completed'/)
assert.doesNotMatch(migration, /delete from public\.missions\s*;/)

console.log("Missione profilo implicita rimossa con filtro selettivo verificato.")
