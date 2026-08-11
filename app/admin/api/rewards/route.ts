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
      const threshold = number(body.threshold_points, 0, 1000000)
      if (!name || quantity === null || cost === null || threshold === null) return reply({ error: "Compila tutti i campi." }, 400)
      const { data, error } = await supabase.from("rewards").insert({
        event_code: code, code: `reward-${crypto.randomUUID()}`, name,
        description: cleanText(body.description, 1000), points_cost: cost,
        quantity_total: quantity, reward_type: "threshold", threshold_points: threshold,
        podium_position: null, starts_at: null,
        active: true,
      } as never).select("*").single()
      if (error) throw error
      return reply({ item: data }, 201)
    }

    if (action === "save_template") {
      const resource = body.resource === "mission" ? "mission" : body.resource === "reward" ? "reward" : ""
      const id = cleanText(body.id, 36)
      if (!resource || !UUID.test(id)) return reply({ error: "Elemento non valido." }, 400)

      if (resource === "mission") {
        const { data: source, error: sourceError } = await supabase.from("missions")
          .select("title,description,points,verification_mode,verification_key")
          .eq("id", id).eq("event_code", code).maybeSingle()
        if (sourceError) throw sourceError
        if (!source) return reply({ error: "Missione non trovata." }, 404)
        const mission = source as { title:string; description:string; points:number; verification_mode:string; verification_key:string|null }
        const { data, error } = await supabase.from("engagement_templates").insert({
          template_type: "mission", title: mission.title, description: mission.description,
          points: mission.points, verification_mode: mission.verification_mode,
          verification_key: mission.verification_key,
        } as never).select("*").single()
        if (error) throw error
        return reply({ item: data }, 201)
      }

      const { data: source, error: sourceError } = await supabase.from("rewards")
        .select("name,description,points_cost,quantity_total,threshold_points")
        .eq("id", id).eq("event_code", code).eq("reward_type", "threshold").maybeSingle()
      if (sourceError) throw sourceError
      if (!source) return reply({ error: "Premio non trovato." }, 404)
      const reward = source as { name:string; description:string; points_cost:number; quantity_total:number; threshold_points:number }
      const { data, error } = await supabase.from("engagement_templates").insert({
        template_type: "reward", title: reward.name, description: reward.description,
        points_cost: reward.points_cost, quantity_total: reward.quantity_total,
        threshold_points: reward.threshold_points,
      } as never).select("*").single()
      if (error) throw error
      return reply({ item: data }, 201)
    }

    if (action === "create_from_template") {
      const templateId = cleanText(body.template_id, 36)
      if (!UUID.test(templateId)) return reply({ error: "Modello non valido." }, 400)
      const { data: template, error: templateError } = await supabase.from("engagement_templates")
        .select("*").eq("id", templateId).maybeSingle()
      if (templateError) throw templateError
      if (!template) return reply({ error: "Modello non trovato." }, 404)
      const saved = template as { template_type:string; title:string; description:string; points:number|null; verification_mode:string|null; verification_key:string|null; points_cost:number|null; quantity_total:number|null; threshold_points:number|null }

      if (saved.template_type === "mission") {
        const { data, error } = await supabase.from("missions").insert({
          event_code: code, code: `mission-${crypto.randomUUID()}`, title: saved.title,
          description: saved.description, points: saved.points,
          verification_mode: saved.verification_mode, verification_key: saved.verification_key,
          active: true,
        } as never).select("*").single()
        if (error) throw error
        return reply({ item: data }, 201)
      }

      const { data, error } = await supabase.from("rewards").insert({
        event_code: code, code: `reward-${crypto.randomUUID()}`, name: saved.title,
        description: saved.description, points_cost: saved.points_cost,
        quantity_total: saved.quantity_total, reward_type: "threshold",
        threshold_points: saved.threshold_points, podium_position: null, starts_at: null, active: true,
      } as never).select("*").single()
      if (error) throw error
      return reply({ item: data }, 201)
    }

    if (action === "approve_manual") {
      const participant = cleanText(body.participant_id, 36)
      const mission = cleanText(body.mission_id, 36)
      if (!UUID.test(participant) || !UUID.test(mission)) return reply({ error: "Partecipante o missione non validi." }, 400)

      const [participantResult, missionResult] = await Promise.all([
        supabase.from("participants")
          .select("id,event_code")
          .eq("id", participant)
          .maybeSingle(),
        supabase.from("missions")
          .select("id,event_code,points,verification_mode,active,starts_at,ends_at")
          .eq("id", mission)
          .maybeSingle(),
      ])

      if (participantResult.error) throw participantResult.error
      if (missionResult.error) throw missionResult.error

      const selectedParticipant = participantResult.data as { id:string; event_code:string } | null
      const selectedMission = missionResult.data as {
        id:string; event_code:string; points:number; verification_mode:string;
        active:boolean; starts_at:string|null; ends_at:string|null
      } | null
      const now = Date.now()
      const missionAvailable = Boolean(
        selectedMission &&
        selectedMission.event_code === code &&
        selectedMission.verification_mode === "manual" &&
        selectedMission.active &&
        (!selectedMission.starts_at || new Date(selectedMission.starts_at).getTime() <= now) &&
        (!selectedMission.ends_at || new Date(selectedMission.ends_at).getTime() > now)
      )

      if (!selectedParticipant || selectedParticipant.event_code !== code || !missionAvailable || !selectedMission) {
        return reply({ error: "Partecipante o missione non appartengono a questo evento." }, 400)
      }

      const { data: completion, error: completionError } = await supabase
        .from("participant_mission_completions")
        .upsert({
          participant_id: participant,
          mission_id: mission,
          points_awarded: selectedMission.points,
          verification_mode: "manual",
          verification_evidence: {
            approved_at: new Date().toISOString(),
            source: "admin_points_staff",
          },
          approval_note: cleanText(body.note, 500) || null,
        } as never, {
          onConflict: "participant_id,mission_id",
          ignoreDuplicates: true,
        })
        .select("id")
        .maybeSingle()

      if (completionError) throw completionError
      const insertedCompletion = completion as { id:string } | null

      const { error: requestError } = await supabase.from("mission_validation_requests").update({
        status: "approved", resolved_at: new Date().toISOString(),
      } as never).eq("participant_id",participant).eq("mission_id",mission).eq("status","pending")
      if (requestError) {
        console.warn("Mission validation request update skipped", requestError)
      }

      return reply({
        result: {
          completion_id: insertedCompletion?.id || null,
          awarded: Boolean(insertedCompletion),
          already_awarded: !insertedCompletion,
        },
      })
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
  const table = body?.resource === "mission" ? "missions" : body?.resource === "reward" ? "rewards" : body?.resource === "template" ? "engagement_templates" : ""
  const id = cleanText(body?.id, 36)
  const code = eventCode(body?.event_code)
  if (!table || !UUID.test(id) || !code) return reply({ error: "Dati non validi." }, 400)
  const supabase = getSupabaseAdmin()
  let changes: Record<string, unknown>

  if (body?.action === "update") {
    const title = cleanText(body.title, 120)
    const description = cleanText(body.description, 1000)
    if (!title) return reply({ error: "Inserisci un titolo valido." }, 400)
    if (table === "missions") {
      const points = number(body.points, 1, 10000)
      if (points === null) return reply({ error: "Punti non validi." }, 400)
      changes = { title, description, points }
    } else if (table === "rewards") {
      const pointsCost = number(body.points_cost, 0, 1000000)
      const quantity = number(body.quantity_total, 1, 100000)
      const threshold = number(body.threshold_points, 0, 1000000)
      if (pointsCost === null || quantity === null || threshold === null) return reply({ error: "Valori premio non validi." }, 400)
      changes = { name: title, description, points_cost: pointsCost, quantity_total: quantity, threshold_points: threshold }
    } else {
      const kind = body.template_type === "mission" ? "mission" : body.template_type === "reward" ? "reward" : ""
      if (!kind) return reply({ error: "Tipo di modello non valido." }, 400)
      changes = kind === "mission"
        ? { title, description, points: number(body.points, 1, 10000), updated_at: new Date().toISOString() }
        : { title, description, points_cost: number(body.points_cost, 0, 1000000), quantity_total: number(body.quantity_total, 1, 100000), threshold_points: number(body.threshold_points, 0, 1000000), updated_at: new Date().toISOString() }
      if (Object.values(changes).some((value) => value === null)) return reply({ error: "Valori del modello non validi." }, 400)
    }
  } else if (table === "rewards" && body?.action === "assign_podium") {
    return reply({ error: "I premi finali del podio non sono disponibili." }, 400)
  } else {
    if (typeof body?.active !== "boolean") return reply({ error: "Dati non validi." }, 400)
    changes = { active: body.active }
  }

  let query = supabase.from(table).update(changes as never).eq("id", id)
  if (table !== "engagement_templates") query = query.eq("event_code", code)
  const { data, error } = await query.select("*").maybeSingle()
  if (error) return reply({ error: "Aggiornamento non riuscito." }, 500)
  return data ? reply({ item: data }) : reply({ error: "Elemento non trovato." }, 404)
}

export async function DELETE(request: Request) {
  if (!(await authorized(request))) return reply({ error: "Accesso non valido." }, 401)
  const body = await input(request)
  const table = body?.resource === "mission" ? "missions" : body?.resource === "reward" ? "rewards" : body?.resource === "template" ? "engagement_templates" : ""
  const id = cleanText(body?.id, 36)
  const code = eventCode(body?.event_code)
  if (!table || !UUID.test(id) || !code) return reply({ error: "Dati non validi." }, 400)
  let query = getSupabaseAdmin().from(table).delete().eq("id", id)
  if (table !== "engagement_templates") query = query.eq("event_code", code)
  const { data, error } = await query.select("id").maybeSingle()
  if (error) return reply({ error: "Non puoi eliminare un elemento già utilizzato. Puoi disattivarlo." }, 409)
  return data ? reply({ ok: true }) : reply({ error: "Elemento non trovato." }, 404)
}
