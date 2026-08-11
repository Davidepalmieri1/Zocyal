import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f-]{36}$/i
const EVENT = /^[a-z0-9_-]{1,64}$/

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    return reply({ error: "Origine non valida." }, 403)
  }

  const authorization = request.headers.get("authorization") || ""
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : ""
  if (!accessToken) return reply({ error: "Sessione partecipante non valida." }, 401)

  let body: { event_code?: unknown; mission_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return reply({ error: "Richiesta non valida." }, 400)
  }

  const code = typeof body.event_code === "string"
    ? body.event_code.trim().toLowerCase()
    : ""
  const missionId = typeof body.mission_id === "string"
    ? body.mission_id.trim()
    : ""
  if (!EVENT.test(code) || !UUID.test(missionId)) {
    return reply({ error: "Evento o missione non validi." }, 400)
  }

  const supabase = getSupabaseAdmin()

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return reply({ error: "Sessione partecipante scaduta." }, 401)
    }

    const [participantResult, missionResult] = await Promise.all([
      supabase.from("participants")
        .select("id,event_code")
        .eq("auth_user_id", userData.user.id)
        .eq("event_code", code)
        .limit(1)
        .maybeSingle(),
      supabase.from("missions")
        .select("id,event_code,verification_mode,active,starts_at,ends_at")
        .eq("id", missionId)
        .eq("event_code", code)
        .maybeSingle(),
    ])

    if (participantResult.error) throw participantResult.error
    if (missionResult.error) throw missionResult.error

    const participant = participantResult.data as { id:string; event_code:string } | null
    const mission = missionResult.data as {
      id:string; event_code:string; verification_mode:string; active:boolean;
      starts_at:string|null; ends_at:string|null
    } | null
    const now = Date.now()
    const missionAvailable = Boolean(
      mission &&
      mission.verification_mode === "manual" &&
      mission.active &&
      (!mission.starts_at || new Date(mission.starts_at).getTime() <= now) &&
      (!mission.ends_at || new Date(mission.ends_at).getTime() > now)
    )

    if (!participant) return reply({ error: "Profilo non collegato a questo evento." }, 404)
    if (!mission || !missionAvailable) return reply({ error: "Missione non disponibile." }, 400)

    const { data: completion, error: completionError } = await supabase
      .from("participant_mission_completions")
      .select("id")
      .eq("participant_id", participant.id)
      .eq("mission_id", missionId)
      .maybeSingle()
    if (completionError) throw completionError
    if (completion) return reply({ error: "Missione già completata." }, 409)

    const { data: validationRequest, error: requestError } = await supabase
      .from("mission_validation_requests")
      .upsert({
        event_code: code,
        participant_id: participant.id,
        mission_id: missionId,
        status: "pending",
        requested_at: new Date().toISOString(),
        resolved_at: null,
      } as never, { onConflict: "participant_id,mission_id" })
      .select("id,status")
      .single()

    if (requestError) throw requestError
    return reply({ request: validationRequest }, 201)
  } catch (error) {
    console.error("Mission validation request error", error)
    return reply({ error: "Richiesta non salvata. Verifica la configurazione delle convalide." }, 500)
  }
}
