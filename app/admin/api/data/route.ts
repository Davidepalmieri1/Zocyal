import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"
import { buildDanceAnalytics } from "@/app/admin/lib/dance-analytics"

export const dynamic = "force-dynamic"

const VIEWS = new Set([
  "dashboard",
  "participants",
  "matches",
  "chat",
  "analytics",
  "rewards",
  "dance",
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

type DrinkOfferRow = {
  id:string; sender_id:string; receiver_id:string; status:string;
  discount_cents:number; created_at:string;
}

type DanceProfileRow = { participant_id:string; role:string; skills:Record<string,string>; available:boolean; updated_at:string }
type DanceInvitationRow = { id:string; sender_id:string; receiver_id:string; style:string; status:string; created_at:string; responded_at:string|null; expires_at:string }

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
      .select("name, venue, code, experience_mode, timezone, venue_logo_url, venue_poster_url")
      .eq("code", code)
      .maybeSingle()

    if (eventError) throw eventError
    if (!event) return json({ error: "Evento non trovato." }, 404)

      if (view === "rewards") {
        stage = "missioni e premi"
        const [missions, rewards, completions, redemptions, leaderboard, rewardParticipants, templates, validationRequests] = await Promise.all([
          supabase
            .from("missions")
            .select("id, event_code, code, title, description, points, verification_mode, verification_key, active, created_at")
            .eq("event_code", code)
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("rewards")
            .select("id, event_code, code, name, description, points_cost, quantity_total, reward_type, threshold_points, podium_position, active, starts_at, created_at")
            .eq("event_code", code)
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("participant_mission_completions")
            .select("id, mission_id, participant_id, points_awarded, verification_mode, approval_note, completed_at, mission:missions!inner(event_code,title), participant:participants(nickname)")
            .eq("mission.event_code", code)
            .order("completed_at", { ascending: false })
            .limit(1000),
          supabase
            .from("reward_redemptions")
            .select("id, reward_id, participant_id, points_spent, status, redeemed_at, fulfilled_at, reward:rewards!inner(event_code,name), participant:participants(nickname)")
            .eq("reward.event_code", code)
            .order("redeemed_at", { ascending: false })
            .limit(1000),
          supabase.rpc("mr_event_leaderboard", { p_event_code: code } as never),
          supabase.from("participants").select("id,nickname,event_code").eq("event_code", code).order("nickname"),
          supabase.from("engagement_templates").select("*").order("updated_at", { ascending: false }).limit(500),
          supabase.from("mission_validation_requests").select("id,participant_id,mission_id,status,requested_at,participant:participants(nickname),mission:missions(title,points)").eq("event_code",code).eq("status","pending").order("requested_at",{ascending:true}).limit(500),
        ])

        const failed = [missions, rewards, completions, redemptions, leaderboard, rewardParticipants].find(
          (result) => result.error
        )
      if (failed?.error) throw failed.error

      if (templates.error) {
        console.warn("Libreria missioni e premi non disponibile:",templates.error)
      }
      if (validationRequests.error) {
        console.warn("Richieste convalida missioni non disponibili:",validationRequests.error)
      }

      return json({
          missions: missions.data || [],
          rewards: rewards.data || [],
          completions: completions.data || [],
          redemptions: redemptions.data || [],
          leaderboard: (leaderboard.data || []).slice(0, 3),
          participants: rewardParticipants.data || [],
          templates: templates.error ? [] : templates.data || [],
          validationRequests: validationRequests.error ? [] : validationRequests.data || [],
        })
    }

    stage = "partecipanti"
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, nickname, age, goal, avatar_url, completed_test")
      .eq("event_code", code)
      .limit(5000)

    if (participantsError) throw participantsError

    const people = (participants || []) as ParticipantRow[]

    if (view === "participants") {
      return json({ participants: people })
    }

    if (view === "dance") {
      if ((event as { experience_mode?: string }).experience_mode !== "caribbean") {
        return json({ error: "La Pista è disponibile soltanto negli eventi caraibici." }, 409)
      }

      stage = "pista caraibica"
      const [profilesResult, invitationsResult] = await Promise.all([
        people.length
          ? supabase
              .from("participant_dance_profiles")
              .select("participant_id,role,skills,available,updated_at")
              .in("participant_id", people.map((person) => person.id))
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("dance_invitations")
          .select("id,sender_id,receiver_id,style,status,created_at,responded_at,expires_at")
          .eq("event_code", code)
          .order("created_at", { ascending: false })
          .limit(200),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (invitationsResult.error) throw invitationsResult.error

      const peopleById = new Map(people.map((person) => [person.id, person]))
      return json({
        event,
        profiles: ((profilesResult.data || []) as unknown as DanceProfileRow[]).map((profile) => ({
          ...profile,
          participant: peopleById.get(profile.participant_id) || null,
        })),
        invitations: ((invitationsResult.data || []) as unknown as DanceInvitationRow[]).map((invitation) => ({
          ...invitation,
          sender: peopleById.get(invitation.sender_id) || null,
          receiver: peopleById.get(invitation.receiver_id) || null,
        })),
      })
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

    stage = "offerte drink"
    const drinkResult = await supabase.from("drink_offers")
      .select("id,sender_id,receiver_id,status,discount_cents,created_at,responded_at,redeemed_at")
      .eq("event_code", code).order("created_at", { ascending: false }).limit(1000)
    if (drinkResult.error) throw drinkResult.error
    const drinkOffers = (drinkResult.data || []) as DrinkOfferRow[]
    const acceptedOfferIds = drinkOffers.filter((offer) => offer.status === "accepted" || offer.status === "redeemed").map((offer) => offer.id)
    const drinkCouponResult = acceptedOfferIds.length
      ? await supabase.from("drink_coupons").select("offer_id,coupon_code").in("offer_id", acceptedOfferIds)
      : { data: [], error: null }
    if (drinkCouponResult.error) throw drinkCouponResult.error
    const couponRows = (drinkCouponResult.data || []) as {offer_id:string;coupon_code:string}[]
    const couponByOffer = new Map(couponRows.map((coupon) => [coupon.offer_id, coupon.coupon_code]))

    if (view === "analytics") {
      let dance = null

      if ((event as { experience_mode?: string }).experience_mode === "caribbean") {
        stage = "analytics pista caraibica"
        const [danceProfilesResult, danceInvitationsResult] = await Promise.all([
          participantIds.length
            ? supabase
                .from("participant_dance_profiles")
                .select("participant_id,role,skills,available,updated_at")
                .in("participant_id", participantIds)
                .limit(5000)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("dance_invitations")
            .select("id,sender_id,receiver_id,style,status,created_at,responded_at,expires_at")
            .eq("event_code", code)
            .order("created_at", { ascending: false })
            .limit(5000),
        ])

        if (danceProfilesResult.error) throw danceProfilesResult.error
        if (danceInvitationsResult.error) throw danceInvitationsResult.error

        dance = buildDanceAnalytics(
          (danceProfilesResult.data || []) as unknown as DanceProfileRow[],
          (danceInvitationsResult.data || []) as unknown as DanceInvitationRow[],
          (event as { timezone?: string | null }).timezone || "Europe/Rome"
        )
      }

      return json({
        experienceMode: (event as { experience_mode?: string }).experience_mode || "standard",
        participants: people.length,
        completedTests: people.filter((person) => person.completed_test).length,
        matches: matches.length,
        messages: messages.length,
        drinkOffers: drinkOffers.length,
        drinkAccepted: drinkOffers.filter((offer) => offer.status === "accepted" || offer.status === "redeemed").length,
        drinkRedeemed: drinkOffers.filter((offer) => offer.status === "redeemed").length,
        dance,
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
        drinkOffers: drinkOffers.length,
        drinkAccepted: drinkOffers.filter((offer) => offer.status === "accepted" || offer.status === "redeemed").length,
        drinkRedeemed: drinkOffers.filter((offer) => offer.status === "redeemed").length,
      },
      drinkCoupons: drinkOffers.filter((offer) => offer.status === "accepted" || offer.status === "redeemed").slice(0, 50).map((offer) => ({
        ...offer,
        coupon_code: couponByOffer.get(offer.id),
        sender: people.find((person) => person.id === offer.sender_id)?.nickname || "Partecipante",
        receiver: people.find((person) => person.id === offer.receiver_id)?.nickname || "Partecipante",
      })),
    })
  } catch (error) {
    console.error("Admin data error", error)
    const configurationMissing =
      stage === "configurazione" &&
      error instanceof Error &&
      error.message.includes("SUPABASE_SECRET_KEY")

    return json(
      {
        error: configurationMissing
          ? "Configurazione locale incompleta: aggiungi SUPABASE_SECRET_KEY e riavvia il server."
          : `Impossibile caricare i dati amministrativi (${stage}).`,
      },
      500
    )
  }
}
