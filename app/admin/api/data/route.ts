import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"

const VIEWS = new Set([
  "dashboard",
  "participants",
  "matches",
  "chat",
  "analytics",
])

type ParticipantRow = {
  id: string
  nickname: string | null
  age: number | null
  goal: string | null
  avatar_url: string | null
  completed_test: boolean | null
}

type MatchRow = Record<string, unknown> & {
  id: string
  user_one: string
  user_two: string
}

type MessageRow = Record<string, unknown> & {
  id: string
  sender_id: string
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}

async function requireAdmin() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token)
}

function normalizeCode(value: string | null) {
  const code = value?.trim().toLowerCase() || ""
  return /^[a-z0-9_-]{1,64}$/.test(code) ? code : ""
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return json({ error: "Sessione amministratore non valida." }, 401)
  }

  const { searchParams } = new URL(request.url)
  const view = searchParams.get("view") || ""
  const code = normalizeCode(searchParams.get("code"))

  if (!VIEWS.has(view) || !code) {
    return json({ error: "Richiesta non valida." }, 400)
  }

  let stage = "configurazione"

  try {
    const supabase = getSupabaseAdmin()
    stage = "evento"
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("name, venue, code")
      .eq("code", code)
      .maybeSingle()

    if (eventError) throw eventError
    if (!event) return json({ error: "Evento non trovato." }, 404)

    stage = "partecipanti"
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, nickname, age, goal, avatar_url, completed_test")
      .eq("event_code", code)
      .order("created_at", { ascending: false })
      .limit(5000)

    if (participantsError) throw participantsError

    const people = (participants || []) as ParticipantRow[]

    if (view === "participants") {
      return json({ participants: people })
    }

    const participantIds = people.map((person) => person.id)
    let matches: MatchRow[] = []

    if (participantIds.length > 0) {
      stage = "match"
      const [asFirst, asSecond] = await Promise.all([
        supabase.from("matches").select("*").in("user_one", participantIds),
        supabase.from("matches").select("*").in("user_two", participantIds),
      ])

      if (asFirst.error) throw asFirst.error
      if (asSecond.error) throw asSecond.error
      matches = uniqueById([
        ...((asFirst.data || []) as MatchRow[]),
        ...((asSecond.data || []) as MatchRow[]),
      ])
    }

    if (view === "matches") {
      const peopleById = new Map(people.map((person) => [person.id, person]))
      return json({
        matches: matches.map((match) => ({
          ...match,
          persona1: peopleById.get(match.user_one) || null,
          persona2: peopleById.get(match.user_two) || null,
        })),
      })
    }

    const matchIds = matches.map((match) => match.id)
    let messages: MessageRow[] = []

    if (matchIds.length > 0) {
      stage = "messaggi"
      const messagesResult = await supabase
        .from("messages")
        .select("*")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false })
        .limit(5000)

      if (messagesResult.error) throw messagesResult.error
      messages = (messagesResult.data || []) as MessageRow[]
    }

    if (view === "chat") {
      const peopleById = new Map(people.map((person) => [person.id, person]))
      return json({
        messages: messages.map((message) => ({
          ...message,
          mittente: peopleById.get(message.sender_id) || null,
        })),
      })
    }

    if (view === "analytics") {
      return json({
        participants: people.length,
        completedTests: people.filter((person) => person.completed_test).length,
        matches: matches.length,
        messages: messages.length,
      })
    }

    let openReports = 0
    if (matchIds.length > 0) {
      stage = "segnalazioni"
      const reportsResult = await supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .in("match_id", matchIds)
        .eq("status", "open")

      if (reportsResult.error) throw reportsResult.error
      openReports = reportsResult.count || 0
    }

    return json({
      event,
      participants: people.slice(0, 50),
      totals: {
        participants: people.length,
        matches: matches.length,
        messages: messages.length,
        reports: openReports,
      },
    })
  } catch (error) {
    console.error("Admin data error", error)
    return json(
      { error: `Impossibile caricare i dati amministrativi (${stage}).` },
      500
    )
  }
}
