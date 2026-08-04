import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
  verifyDestructiveActionPassword,
} from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"

type PersonRow = { id: string; nickname: string | null; avatar_url: string | null }
type ReportRow = {
  id: string
  match_id: string
  reported_by: string
  reported_participant: string
  reason: string | null
  details: string | null
  status: string | null
  created_at: string
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}

async function authorized() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token)
}

function validCode(value: unknown) {
  if (typeof value !== "string") return ""
  const code = value.trim().toLowerCase()
  return /^[a-z0-9_-]{1,64}$/.test(code) ? code : ""
}

function validId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : ""
}

export async function GET(request: Request) {
  if (!(await authorized())) return json({ error: "Accesso non valido." }, 401)

  const code = validCode(new URL(request.url).searchParams.get("code"))
  if (!code) return json({ error: "Codice evento non valido." }, 400)

  const db = getSupabaseAdmin()
  const { data: participants, error: participantsError } = await db
    .from("participants")
    .select("id,nickname,avatar_url")
    .eq("event_code", code)
    .limit(5000)

  if (participantsError) return json({ error: "Impossibile caricare i partecipanti." }, 500)

  const people = (participants || []) as PersonRow[]
  const ids = people.map((person) => person.id)
  if (!ids.length) return json({ reports: [] })

  const { data: reports, error } = await db
    .from("reports")
    .select("id,match_id,reported_by,reported_participant,reason,details,status,created_at")
    .in("reported_participant", ids)
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) return json({ error: "Impossibile caricare le segnalazioni." }, 500)

  const byId = new Map(people.map((person) => [person.id, person]))
  return json({
    reports: ((reports || []) as ReportRow[]).map((report) => ({
      ...report,
      reporter: byId.get(report.reported_by) || null,
      reported: byId.get(report.reported_participant) || null,
    })),
  })
}

export async function DELETE(request: Request) {
  if (!(await authorized())) return json({ error: "Accesso non valido." }, 401)
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Richiesta non valida." }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: "Dati non validi." }, 400)
  }

  const code = validCode(body.code)
  const participantId = validId(body.participantId)
  if (!code || !participantId) return json({ error: "Dati non validi." }, 400)
  if (!verifyDestructiveActionPassword(body.password)) {
    return json({ error: "Password di eliminazione errata." }, 403)
  }

  const db = getSupabaseAdmin()
  const { data: participant, error: readError } = await db
    .from("participants")
    .select("id,nickname")
    .eq("id", participantId)
    .eq("event_code", code)
    .maybeSingle()

  if (readError) return json({ error: "Impossibile verificare il partecipante." }, 500)
  if (!participant) return json({ error: "Partecipante non trovato in questo evento." }, 404)
  const selectedParticipant = participant as { id: string; nickname: string | null }

  const { error } = await db.rpc("admin_delete_participant", {
    p_event_code: code,
    p_participant_id: participantId,
  } as never)

  if (error) {
    console.error("Eliminazione partecipante non riuscita:", error)
    return json({ error: "Eliminazione non riuscita. Verifica di aver applicato la nuova migrazione SQL." }, 500)
  }

  return json({ deleted: true, participantId, nickname: selectedParticipant.nickname })
}
