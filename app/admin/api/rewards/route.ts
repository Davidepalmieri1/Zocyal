import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f-]{36}$/i
const EVENT = /^[a-z0-9_-]{1,64}$/

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}

async function authorized(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token) && request.headers.get("origin") === new URL(request.url).origin
}

async function input(request: Request) {
  try {
    const value = await request.json()
    return value && typeof value === "object" ? value as Record<string, unknown> : null
  } catch { return null }
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function eventCode(value: unknown) {
  const code = cleanText(value, 64).toLowerCase()
  return EVENT.test(code) ? code : ""
}

function number(value: unknown, min = 0, max = 1000000) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return reply({ error: "Accesso non valido." }, 401)
  const body = await input(request)
  const code = eventCode(body?.event_code)
  const action = cleanText(body?.action, 30)
  if (!body || !code) return reply({ error: "Dati non validi." }, 400)
  const supabase = getSupabaseAdmin()

  try {
    if (action === "create_mission") {
      const title = cleanText(body.title, 120)
      const points = number(body.points, 1, 10000)
      const mode = body.verification_mode === "manual" ? "manual" : "automatic"
      const key = mode === "automatic" ? cleanText(body.verification_key, 40) : null
      if (!title || points === null || (mode === "automatic" && !key)) return reply({ error: "Compila tutti i campi." }, 400)
      const { data, error } = await supabase.from("missions").insert({
        event_code: code, code: `mission-${crypto.randomUUID()}`, title,
        description: cleanText(body.description, 1000), points,
        verification_mode: mode, verification_key: key, active: true,
      } as never).select("*").single()
      if (error) throw error
      return reply({ item: data }, 201)
    }

    if (action === "create_reward") {
      const name = cleanText(body.name, 120)
      const quantity = number(body.quantity_total, 1, 100000)
      const cost = number(body.points_cost, 0, 1000000)
      const type = body.reward_type === "podium_position" ? "podium_position" : "threshold"
      const position = type === "podium_position" ? number(body.podium_position, 1, 3) : null
      const threshold = type === "threshold" ? number(body.threshold_points, 0, 1000000) : null
      if (!name || quantity === null || cost === null || (type === "podium_position" ? position === null : threshold === null)) return reply({ error: "Compila tutti i campi." }, 400)
      const { data, error } = await supabase.from("rewards").insert({
        event_code: code, code: `reward-${crypto.randomUUID()}`, name,
        description: cleanText(body.description, 1000), points_cost: cost,
        quantity_total: quantity, reward_type: type, threshold_points: threshold,
        podium_position: position, starts_at: type === "podium_position" ? new Date().toISOString() : null,
        active: true,
      } as never).select("*").single()
      if (error) throw error
      return reply({ item: data }, 201)
    }

    if (action === "approve_manual") {
      const participant = cleanText(body.participant_id, 36)
      const mission = cleanText(body.mission_id, 36)
      if (!UUID.test(participant) || !UUID.test(mission)) return reply({ error: "Partecipante o missione non validi." }, 400)
      const { data, error } = await supabase.rpc("approve_manual_mission", {
        p_participant_id: participant, p_mission_id: mission,
        p_approval_note: cleanText(body.note, 500) || null,
      } as never)
      if (error) throw error
      return reply({ result: data })
    }

    if (action === "fulfill_redemption") {
      const id = cleanText(body.redemption_id, 36)
      if (!UUID.test(id)) return reply({ error: "Riscatto non valido." }, 400)
      const { data, error } = await supabase.rpc("fulfill_reward_redemption", {
        p_redemption_id: id, p_fulfillment_note: cleanText(body.note, 500) || null,
      } as never)
      if (error) throw error
      return reply({ result: data })
    }

    return reply({ error: "Azione non riconosciuta." }, 400)
  } catch (error) {
    console.error("Rewards admin error", error)
    return reply({ error: "Operazione non riuscita." }, 500)
  }
}

export async function PATCH(request: Request) {
  if (!(await authorized(request))) return reply({ error: "Accesso non valido." }, 401)
  const body = await input(request)
  const table = body?.resource === "mission" ? "missions" : body?.resource === "reward" ? "rewards" : ""
  const id = cleanText(body?.id, 36)
  const code = eventCode(body?.event_code)
  if (!table || !UUID.test(id) || !code || typeof body?.active !== "boolean") return reply({ error: "Dati non validi." }, 400)
  const { data, error } = await getSupabaseAdmin().from(table).update({ active: body.active } as never).eq("id", id).eq("event_code", code).select("*").maybeSingle()
  if (error) return reply({ error: "Aggiornamento non riuscito." }, 500)
  return data ? reply({ item: data }) : reply({ error: "Elemento non trovato." }, 404)
}
