import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"
const EVENT = /^[a-z0-9_-]{1,64}$/
const UUID = /^[0-9a-f-]{36}$/i
type Answers = Record<string, string | null>
type ParticipantCandidate = { id:string; goal:string|null }
type ParticipantAnswers = Answers & { participant_id:string }
type GameTable = { id:string; reward_mission_id:string; points_reward:number }
type JoinedInvitation = { participant_id:string; status:string; table:GameTable|GameTable[] }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}
async function authorized(request?: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token) && (!request || request.headers.get("origin") === new URL(request.url).origin)
}
function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : "" }
function code(value: unknown) { const result = text(value, 64).toLowerCase(); return EVENT.test(result) ? result : "" }
function tags(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(item => text(item, 80)).filter(Boolean))].slice(0, 12) : []
}

export async function GET(request: Request) {
  if (!(await authorized())) return json({ error: "Sessione amministratore non valida." }, 401)
  const eventCode = code(new URL(request.url).searchParams.get("code"))
  if (!eventCode) return json({ error: "Evento non valido." }, 400)
  const db = getSupabaseAdmin()
  const eventResult = await db.from("events").select("experience_mode").eq("code", eventCode).maybeSingle()
  if (eventResult.error) return json({ error: "Impossibile verificare l'evento." }, 500)
  if ((eventResult.data as { experience_mode?:string } | null)?.experience_mode === "caribbean") return json({ error: "I tavoli non sono disponibili negli eventi caraibici." }, 409)
  const [tablesResult, templatesResult] = await Promise.all([
    db.from("game_tables").select("*, invitations:game_table_invitations(*, participant:participants(id,nickname,avatar_url))").eq("event_code", eventCode).order("created_at", { ascending: false }),
    db.from("game_table_templates").select("id,name,interest_tags,points_reward,created_at,updated_at").order("updated_at", { ascending: false }),
  ])
  if (tablesResult.error) return json({ error: "Impossibile caricare i tavoli." }, 500)
  if (templatesResult.error) return json({ error: "Impossibile caricare i giochi salvati." }, 500)
  return json({ tables: tablesResult.data || [], templates: templatesResult.data || [] })
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return json({ error: "Accesso non valido." }, 401)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const eventCode = code(body?.event_code), action = text(body?.action, 30)
  if (!body || !eventCode) return json({ error: "Dati non validi." }, 400)
  const db = getSupabaseAdmin()
  const eventResult = await db.from("events").select("experience_mode").eq("code", eventCode).maybeSingle()
  if (eventResult.error) return json({ error: "Impossibile verificare l'evento." }, 500)
  if ((eventResult.data as { experience_mode?:string } | null)?.experience_mode === "caribbean") return json({ error: "I tavoli non sono disponibili negli eventi caraibici." }, 409)

  if (action === "save_template") {
    const name = text(body.game, 120), interestTags = tags(body.interest_tags)
    const points = Number(body.points_reward)
    if (!name || !interestTags.length || !Number.isSafeInteger(points) || points < 3 || points > 10) {
      return json({ error: "Compila gioco, interessi e punti (3-10) prima di salvarlo." }, 400)
    }
    const { data, error } = await db
      .from("game_table_templates")
      .upsert({ name, interest_tags: interestTags, points_reward: points, updated_at: new Date().toISOString() } as never, { onConflict: "normalized_name" })
      .select("id,name,interest_tags,points_reward,created_at,updated_at")
      .single()
    return error
      ? json({ error: "Salvataggio del gioco non riuscito." }, 500)
      : json({ template: data }, 201)
  }

  if (action === "delete_template") {
    const templateId = text(body.template_id, 36)
    if (!UUID.test(templateId)) return json({ error: "Gioco salvato non valido." }, 400)
    const { error } = await db.from("game_table_templates").delete().eq("id", templateId)
    return error
      ? json({ error: "Rimozione del gioco non riuscita." }, 500)
      : json({ ok: true })
  }

  if (action === "create") {
    const name = text(body.name, 120), game = text(body.game, 120), interestTags = tags(body.interest_tags)
    const points = Number(body.points_reward)
    if (!name || !game || !interestTags.length || !Number.isSafeInteger(points) || points < 3 || points > 10) return json({ error: "Compila nome, gioco, interessi e punti (3-10)." }, 400)

    const { data: participants, error: peopleError } = await db
      .from("participants")
      .select("id,goal")
      .eq("event_code", eventCode)
      .eq("completed_test", true)
    if (peopleError) {
      console.error("Errore caricamento partecipanti compatibili:", peopleError)
      return json({ error: "Impossibile individuare i partecipanti compatibili." }, 500)
    }

    const people = (participants || []) as ParticipantCandidate[]
    const participantIds = people.map(person => person.id)
    const answersResult = participantIds.length
      ? await db
          .from("answers")
          .select("participant_id,question_1,question_2,question_3,question_4,question_5,question_6,question_7,question_8,question_9,question_10,question_11,question_12")
          .in("participant_id", participantIds)
      : { data: [] as ParticipantAnswers[], error: null }
    if (answersResult.error) {
      console.error("Errore caricamento interessi partecipanti:", answersResult.error)
      return json({ error: "Impossibile individuare i partecipanti compatibili." }, 500)
    }

    const answersByParticipant = new Map(
      ((answersResult.data || []) as ParticipantAnswers[]).map(answer => [
        answer.participant_id,
        answer,
      ])
    )
    const wanted = new Set(interestTags.map(tag => tag.toLocaleLowerCase("it")))
    const compatible = people.filter(person => {
      const answer = answersByParticipant.get(person.id)
      const values = [person.goal, ...Object.values(answer || {})].filter((value): value is string => typeof value === "string")
      return values.some(value => wanted.has(value.toLocaleLowerCase("it")))
    })

    const missionId = crypto.randomUUID()
    const { error: missionError } = await db.from("missions").insert({ id: missionId, event_code: eventCode, code: `game-table-${crypto.randomUUID()}`, title: `Partecipa: ${name}`, description: `Siediti al tavolo per giocare a ${game}.`, points, verification_mode: "manual", active: true } as never)
    if (missionError) return json({ error: "Impossibile configurare i punti del tavolo." }, 500)
    const { data: table, error: tableError } = await db.from("game_tables").insert({ event_code: eventCode, name, game, interest_tags: interestTags, points_reward: points, reward_mission_id: missionId } as never).select("*").single()
    const createdTable = table as unknown as GameTable | null
    if (tableError || !createdTable) { await db.from("missions").delete().eq("id", missionId); return json({ error: "Creazione tavolo non riuscita." }, 500) }
    if (compatible.length) {
      const { error: inviteError } = await db.from("game_table_invitations").insert(compatible.map(person => ({ table_id: createdTable.id, participant_id: person.id })) as never)
      if (inviteError) { await db.from("game_tables").delete().eq("id", createdTable.id); await db.from("missions").delete().eq("id", missionId); return json({ error: "Inviti non creati." }, 500) }
    }
    return json({ table: createdTable, invited: compatible.length }, 201)
  }

  if (action === "mark_joined") {
    const invitationId = text(body.invitation_id, 36)
    if (!UUID.test(invitationId)) return json({ error: "Invito non valido." }, 400)
    const { data: invitation } = await db.from("game_table_invitations").select("*, table:game_tables!inner(event_code,points_reward,reward_mission_id)").eq("id", invitationId).eq("table.event_code", eventCode).maybeSingle()
    const joinedInvitation = invitation as unknown as JoinedInvitation | null
    if (!joinedInvitation || joinedInvitation.status !== "accepted") return json({ error: "Il partecipante non ha un invito accettato." }, 409)
    const table = Array.isArray(joinedInvitation.table) ? joinedInvitation.table[0] : joinedInvitation.table
    const { error: awardError } = await db.from("participant_mission_completions").upsert({ participant_id: joinedInvitation.participant_id, mission_id: table.reward_mission_id, points_awarded: table.points_reward, verification_mode: "manual", approval_note: "Presenza al tavolo confermata", verification_evidence: { game_table_invitation_id: invitationId } } as never, { onConflict: "participant_id,mission_id", ignoreDuplicates: true })
    if (awardError) return json({ error: "Assegnazione punti non riuscita." }, 500)
    const { error } = await db.from("game_table_invitations").update({ status: "joined", joined_at: new Date().toISOString(), points_awarded: table.points_reward } as never).eq("id", invitationId).eq("status", "accepted")
    return error ? json({ error: "Conferma presenza non riuscita." }, 500) : json({ ok: true })
  }

  if (action === "close") {
    const tableId = text(body.table_id, 36)
    if (!UUID.test(tableId)) return json({ error: "Tavolo non valido." }, 400)
    const { error } = await db.from("game_tables").update({ status: "closed", updated_at: new Date().toISOString() } as never).eq("id", tableId).eq("event_code", eventCode)
    return error ? json({ error: "Chiusura non riuscita." }, 500) : json({ ok: true })
  }
  return json({ error: "Azione non riconosciuta." }, 400)
}
