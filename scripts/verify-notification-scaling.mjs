import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const center = readFileSync("app/components/NotificationCenter.tsx", "utf8")
const migration = readFileSync("supabase/migrations/20260922_notification_center_snapshot.sql", "utf8")
const publication = readFileSync("supabase/migrations/20260924_verify_realtime_publication.sql", "utf8")

assert.match(center, /get_notification_center_snapshot/)
assert.match(center, /pendingLoadRef\.current = true/)
assert.match(center, /while \(pendingLoadRef\.current\)/)
assert.match(center, /const schedulePoll =/)
assert.match(center, /realtimeReady \? 30_000 : 10_000/)
assert.match(center, /window\.clearTimeout\(poll\)/)
assert.match(center, /await connect\(\)[\s\S]+await load\(\)/)
assert.match(center, /if \(!channel\) void connect\(\)/)
assert.match(center, /participantIdRef\.current \|\| await resolveCurrentParticipant\(code\)/)
assert.doesNotMatch(center, /setInterval\([^\n]+,5000\)/)

for (const source of [
  "matches",
  "messages",
  "game_table_invitations",
  "likes",
  "participant_mission_completions",
  "participant_notification_reads",
  "drink_offers",
  "dance_invitations",
  "reward_redemptions",
]) {
  assert.ok(migration.includes(`public.${source}`), `Snapshot missing ${source}`)
}

for (const source of [
  "likes",
  "matches",
  "messages",
  "participant_mission_completions",
  "reward_redemptions",
  "drink_offers",
  "game_table_invitations",
  "dance_invitations",
  "participant_dance_profiles",
]) {
  assert.ok(publication.includes(`'${source}'`), `Realtime publication missing ${source}`)
}

for (const page of [
  "app/evento/[code]/tavoli/page.tsx",
  "app/evento/[code]/balla/page.tsx",
  "app/evento/[code]/chat/[match_id]/page.tsx",
]) {
  assert.doesNotMatch(readFileSync(page, "utf8"), /new Notification\(/, `Duplicate system notification in ${page}`)
}

assert.match(migration, /current_participant_for_event\(v_event\)/)
assert.match(migration, /grant execute on function public\.get_notification_center_snapshot\(text\)/)

console.log("Notification scaling: snapshot unico, coda e fallback Realtime verificati con successo.")
