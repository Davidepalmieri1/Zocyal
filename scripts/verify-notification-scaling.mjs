import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const center = readFileSync("app/components/NotificationCenter.tsx", "utf8")
const migration = readFileSync("supabase/migrations/20260922_notification_center_snapshot.sql", "utf8")

assert.match(center, /get_notification_center_snapshot/)
assert.match(center, /pendingLoadRef\.current = true/)
assert.match(center, /while \(pendingLoadRef\.current\)/)
assert.match(center, /if\(!document\.hidden\) refresh\(\)/)
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

assert.match(migration, /current_participant_for_event\(v_event\)/)
assert.match(migration, /grant execute on function public\.get_notification_center_snapshot\(text\)/)

console.log("Notification scaling: snapshot unico, coda e fallback Realtime verificati con successo.")
