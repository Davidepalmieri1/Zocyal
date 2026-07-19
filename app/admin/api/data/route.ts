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
  "rewards",
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

      if (view === "rewards") {
        stage = "missioni e premi"
        const [missions, rewards, completions, redemptions, leaderboard, rewardParticipants] = await Promise.all([
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
          supabase.from("participants").select("id,nickname").eq("event_code", code).order("nickname"),
        ])

        const failed = [missions, rewards, completions, redemptions, leaderboard, rewardParticipants].find(
          (result) => result.error
        )
      if (failed?.error) throw failed.error

      return json({
          missions: missions.data || [],
          rewards: rewards.data || [],
          completions: completions.data || [],
          redemptions: redemptions.data || [],
          leaderboard: (leaderboard.data || []).slice(0, 3),
          participants: rewardParticipants.data || [],
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
    const acceptedOfferIds = drinkOffers.filter((offer) => offer.status === "accepted").map((offer) => offer.id)
    const drinkCouponResult = acceptedOfferIds.length
      ? await supabase.from("drink_coupons").select("offer_id,coupon_code").in("offer_id", acceptedOfferIds)
      : { data: [], error: null }
    if (drinkCouponResult.error) throw drinkCouponResult.error
    const couponRows = (drinkCouponResult.data || []) as {offer_id:string;coupon_code:string}[]
    const couponByOffer = new Map(couponRows.map((coupon) => [coupon.offer_id, coupon.coupon_code]))

    if (view === "analytics") {
      return json({
        participants: people.length,
        completedTests: people.filter((person) => person.completed_test).length,
        matches: matches.length,
        messages: messages.length,
        drinkOffers: drinkOffers.length,
        drinkAccepted: drinkOffers.filter((offer) => offer.status === "accepted" || offer.status === "redeemed").length,
        drinkRedeemed: drinkOffers.filter((offer) => offer.status === "redeemed").length,
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
      drinkCoupons: drinkOffers.filter((offer) => offer.status === "accepted").slice(0, 50).map((offer) => ({
        ...offer,
        coupon_code: couponByOffer.get(offer.id),
        sender: people.find((person) => person.id === offer.sender_id)?.nickname || "Partecipante",
        receiver: people.find((person) => person.id === offer.receiver_id)?.nickname || "Partecipante",
      })),
    })
  } catch (error) {
    console.error("Admin data error", error)
    return json(
      { error: `Impossibile caricare i dati amministrativi (${stage}).` },
      500
    )
  }
}
