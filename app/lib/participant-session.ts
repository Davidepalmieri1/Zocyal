import { supabase } from "@/lib/supabase"

export type ParticipantSession = {
  participantId: string
  eventCode: string
}

export type ParticipantProfileResult = ParticipantSession & {
  recoveryCode: string
  completedTest: boolean
}

type ParticipantRpcRow = {
  participant_id?: string
  id?: string
  recovery_code?: string | null
  completed_test?: boolean | null
}

function firstRow(data: unknown): ParticipantRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as ParticipantRpcRow | undefined) ?? null
  }

  return data && typeof data === "object"
    ? (data as ParticipantRpcRow)
    : null
}

function requiredParticipantId(row: ParticipantRpcRow | null) {
  const participantId = row?.participant_id ?? row?.id

  if (!participantId) {
    throw new Error("La procedura non ha restituito un partecipante valido.")
  }

  return participantId
}

export async function ensureAnonymousSession() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (sessionData.session?.user) return sessionData.session.user

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) throw error
  if (!data.user) {
    throw new Error("Impossibile avviare la sessione partecipante.")
  }

  return data.user
}

export function saveParticipantSession(session: ParticipantSession) {
  localStorage.setItem("participant_id", session.participantId)
  localStorage.setItem("event_code", session.eventCode)
}

export async function createParticipantProfile(input: {
  eventCode: string
  nickname: string
  age: number
  gender: string
  goal: string
  avatarUrl: string
}): Promise<ParticipantProfileResult> {
  await ensureAnonymousSession()

  const { data, error } = await supabase.rpc("create_participant", {
    p_event_code: input.eventCode,
    p_nickname: input.nickname,
    p_age: input.age,
    p_gender: input.gender,
    p_goal: input.goal,
    p_avatar_url: input.avatarUrl || null,
  })

  if (error) throw error

  const row = firstRow(data)
  const participantId = requiredParticipantId(row)

  if (!row?.recovery_code) {
    throw new Error("La procedura non ha restituito il codice di recupero.")
  }

  saveParticipantSession({ participantId, eventCode: input.eventCode })
  localStorage.setItem("recovery_code", row.recovery_code)

  return {
    participantId,
    eventCode: input.eventCode,
    recoveryCode: row.recovery_code,
    completedTest: Boolean(row.completed_test),
  }
}

export async function recoverParticipantProfile(input: {
  eventCode: string
  recoveryCode: string
}): Promise<ParticipantProfileResult> {
  await ensureAnonymousSession()

  const { data, error } = await supabase.rpc("claim_participant", {
    p_event_code: input.eventCode,
    p_recovery_code: input.recoveryCode,
  })

  if (error) throw error

  const row = firstRow(data)
  const participantId = requiredParticipantId(row)
  const recoveryCode = row?.recovery_code ?? input.recoveryCode

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("completed_test")
    .eq("id", participantId)
    .single()

  if (participantError) throw participantError

  saveParticipantSession({ participantId, eventCode: input.eventCode })
  localStorage.setItem("recovery_code", recoveryCode)

  return {
    participantId,
    eventCode: input.eventCode,
    recoveryCode,
    completedTest: Boolean(participant.completed_test),
  }
}

export async function blockAndReport(input: {
  matchId: string
  reason: string
  details?: string
  createReport: boolean
}) {
  await ensureAnonymousSession()

  const { error } = await supabase.rpc("block_report", {
    p_match_id: input.matchId,
    p_reason: input.reason,
    p_details: input.details?.trim() || null,
    p_create_report: input.createReport,
  })

  if (error) throw error
}
