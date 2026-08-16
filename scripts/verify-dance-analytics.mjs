import assert from "node:assert/strict"
import { buildDanceAnalytics } from "../app/admin/lib/dance-analytics.ts"

const profiles = [
  { participant_id: "a", role: "leader", skills: { bachata: "advanced" }, available: true },
  { participant_id: "b", role: "follower", skills: { bachata: "beginner" }, available: false },
  { participant_id: "c", role: "both", skills: { salsa_cubana: "intermediate" }, available: true },
  { participant_id: "d", role: "follower", skills: { salsa_cubana: "beginner" }, available: true },
  { participant_id: "e", role: "both", skills: { kizomba: "beginner" }, available: true },
]

const invitations = [
  { sender_id: "a", receiver_id: "b", style: "bachata", status: "accepted", created_at: "2026-08-16T20:00:00Z", responded_at: "2026-08-16T20:02:00Z" },
  { sender_id: "c", receiver_id: "d", style: "salsa_cubana", status: "declined", created_at: "2026-08-16T20:15:00Z", responded_at: "2026-08-16T20:19:00Z" },
  { sender_id: "a", receiver_id: "c", style: "bachata", status: "pending", created_at: "2026-08-16T21:00:00Z", responded_at: null },
  { sender_id: "b", receiver_id: "d", style: "bachata", status: "cancelled", created_at: "2026-08-16T21:10:00Z", responded_at: null },
]

const result = buildDanceAnalytics(profiles, invitations, "UTC")

assert.equal(result.profiles, 5)
assert.equal(result.available, 4)
assert.equal(result.invitations, 4)
assert.deepEqual(result.statuses, { pending: 1, accepted: 1, declined: 1, later: 0, cancelled: 1, expired: 0 })
assert.equal(result.acceptanceRate, 50)
assert.equal(result.averageResponseMinutes, 3)
assert.equal(result.uniqueInviters, 3)
assert.equal(result.uniqueReceivers, 3)
assert.equal(result.engagedProfiles, 4)
assert.equal(result.untouchedProfiles, 1)
assert.deepEqual(result.styles[0], { style: "bachata", total: 3, accepted: 1 })
assert.deepEqual(result.hourlyActivity, [{ hour: "20:00", count: 2 }, { hour: "21:00", count: 2 }])

const empty = buildDanceAnalytics([], [], "Invalid/Timezone")
assert.equal(empty.profiles, 0)
assert.equal(empty.acceptanceRate, 0)
assert.equal(empty.averageResponseMinutes, null)
assert.deepEqual(empty.hourlyActivity, [])

console.log("Dance analytics: aggregazioni e casi vuoti verificati con successo.")
