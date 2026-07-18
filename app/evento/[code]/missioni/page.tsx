"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"
import { ensureAnonymousSession } from "@/app/lib/participant-session"
import { supabase } from "@/lib/supabase"

type Missione = {
  id: string
  title: string
  description: string
  points: number
  icon: string
  difficulty: string
  verificationMode: string
  completed: boolean
  completedAt: string | null
}

type Premio = {
  id: string
  title: string
  description: string
  pointsRequired: number
  pointsCost: number
  available: boolean
  claimed: boolean
  rewardType: string
  podiumPosition: number | null
  quantityRemaining: number
}

type ClassificaEntry = {
  participantId: string
  nickname: string
  avatarUrl: string | null
  points: number
  position: number
}

type MissionDashboard = {
  missions: Missione[]
  rewards: Premio[]
  totalPoints: number
  leaderboard: ClassificaEntry[]
  myPosition: number | null
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function boolean(value: unknown) {
  return value === true
}

function normalizeDashboard(data: unknown): MissionDashboard {
  const payload = record(Array.isArray(data) ? data[0] : data)
  const rawMissions = Array.isArray(payload.missions) ? payload.missions : []
  const rawRewards = Array.isArray(payload.rewards)
    ? payload.rewards
    : Array.isArray(payload.available_rewards)
      ? payload.available_rewards
      : []
  const rawLeaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : []
  const pointsAvailable = number(payload.points_available)
  const rawMyPosition = payload.my_position ?? payload.current_position
  const myPosition = rawMyPosition == null ? null : number(rawMyPosition)

  const missions = rawMissions.map((item, index) => {
    const mission = record(item)
    return {
      id: text(mission.id, `mission-${index}`),
      title: text(mission.title ?? mission.name, "Missione"),
      description: text(mission.description),
      points: number(mission.points),
      icon: text(mission.icon, "🎯"),
      difficulty: text(mission.difficulty, "Missione"),
      verificationMode: text(mission.verification_mode, "automatic"),
      completed: boolean(mission.completed ?? mission.is_completed),
      completedAt: text(
        mission.completed_at ?? mission.completedAt,
        ""
      ) || null,
    }
  })

  const rewards = rawRewards.map((item, index) => {
    const reward = record(item)
    const rewardType = text(reward.reward_type, "threshold")
    const pointsRequired = number(
      reward.threshold_points ?? reward.points_cost
    )
    const podiumPosition = reward.podium_position == null
      ? null
      : number(reward.podium_position)
    const quantityRemaining = number(reward.quantity_remaining)
    const pointsCost = number(reward.points_cost)
    const available = quantityRemaining > 0 && pointsAvailable >= pointsCost && (
      rewardType === "threshold"
        ? pointsAvailable >= pointsRequired
        : myPosition !== null && myPosition === podiumPosition
    )

    return {
      id: text(reward.id, `reward-${index}`),
      title: text(reward.title ?? reward.name, "Premio"),
      description: text(reward.description),
      pointsRequired,
      pointsCost,
      available: boolean(reward.available ?? reward.is_available) || available,
      claimed: boolean(reward.redeemed ?? reward.claimed),
      rewardType,
      podiumPosition,
      quantityRemaining,
    }
  })

  const leaderboard = rawLeaderboard.slice(0, 3).map((item, index) => {
    const entry = record(item)
    return {
      participantId: text(entry.participant_id ?? entry.id),
      nickname: text(entry.nickname, "Partecipante"),
      avatarUrl: text(entry.avatar_url, "") || null,
      points: number(entry.points ?? entry.total_points),
      position: number(entry.rank_position ?? entry.position ?? entry.rank) || index + 1,
    }
  })

  return {
    missions,
    rewards,
    totalPoints: number(
      payload.points_available ?? payload.total_points ?? payload.points
    ),
    leaderboard,
    myPosition,
  }
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message)
    if (message.includes("Participant authentication required")) {
      return "Profilo partecipante non collegato a questa sessione."
    }
  }

  return "Non siamo riusciti a caricare missioni e premi."
}

export default function MissioniPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const eventCode = params.code.trim().toLowerCase()

  const [dashboard, setDashboard] = useState<MissionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")
  const [missioneInCorso, setMissioneInCorso] = useState<string | null>(null)
  const [premioInCorso, setPremioInCorso] = useState<string | null>(null)

  const caricaDashboard = useCallback(async () => {
    await ensureAnonymousSession()

    const savedEventCode = localStorage.getItem("event_code")
    const participantId = localStorage.getItem("participant_id")
    if (!participantId || savedEventCode !== eventCode) {
      throw new Error("Participant authentication required")
    }

    const [dashboardResult, leaderboardResult] = await Promise.all([
      supabase.rpc("get_missions_rewards"),
      supabase.rpc("get_event_leaderboard"),
    ])

    if (dashboardResult.error) throw dashboardResult.error
    if (leaderboardResult.error) throw leaderboardResult.error

    const normalized = normalizeDashboard(dashboardResult.data)
    return normalizeDashboard({
      ...record(dashboardResult.data),
      leaderboard: leaderboardResult.data,
      my_position: normalized.myPosition,
    })
  }, [eventCode])

  useEffect(() => {
    let active = true

    void caricaDashboard()
      .then((data) => {
        if (!active) return
        setDashboard(data)
        setErrore("")
      })
      .catch((error: unknown) => {
        console.error("Errore caricamento missioni:", error)
        if (active) setErrore(errorMessage(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [caricaDashboard])

  const completate = useMemo(
    () => dashboard?.missions.filter((mission) => mission.completed).length ?? 0,
    [dashboard]
  )
  const totaleMissioni = dashboard?.missions.length ?? 0
  const progresso = totaleMissioni > 0
    ? Math.round((completate / totaleMissioni) * 100)
    : 0

  async function completaMissione(missionId: string) {
    if (missioneInCorso) return

    setMissioneInCorso(missionId)
    setErrore("")

    try {
      await ensureAnonymousSession()
      const { error } = await supabase.rpc("complete_automatic_mission", {
        p_mission_id: missionId,
      })
      if (error) throw error

      setDashboard(await caricaDashboard())
    } catch (error) {
      console.error("Errore completamento missione:", error)
      setErrore("Missione non completata. Riprova tra poco.")
    } finally {
      setMissioneInCorso(null)
    }
  }

  async function riscattaPremio(rewardId: string) {
    if (premioInCorso) return
    setPremioInCorso(rewardId)
    setErrore("")
    try {
      const { error } = await supabase.rpc("redeem_reward", {
        p_reward_id: rewardId,
        p_idempotency_key: crypto.randomUUID(),
      } as never)
      if (error) throw error
      setDashboard(await caricaDashboard())
    } catch (error) {
      console.error("Errore riscatto premio:", error)
      setErrore("Premio non riscattato. Controlla punti e disponibilità.")
    } finally {
      setPremioInCorso(null)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <Logo size="medium" />
          <div className="mx-auto mt-8 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />
          <p className="mt-5 text-gray-400">Carichiamo le missioni...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-6 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-180px] right-[-120px] h-[380px] w-[380px] rounded-full bg-orange-500/10 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => router.back()} aria-label="Torna indietro" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl transition hover:border-pink-400/40 hover:bg-pink-500/10">
            ‹
          </button>
          <Logo size="small" />
        </header>

        <section className="mt-10 text-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
              Sfide della serata
            </span>
            <h1 className="mt-5 text-4xl font-black sm:text-5xl">Missioni e premi</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
              Completa le sfide, guadagna punti e sblocca i premi disponibili.
            </p>
          </motion.div>
        </section>

        {errore && (
          <div role="alert" className="mx-auto mt-7 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {errore}
          </div>
        )}

        <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto mt-8 max-w-xl overflow-hidden rounded-[30px] border border-pink-400/20 bg-gradient-to-r from-fuchsia-600/15 via-pink-500/10 to-orange-400/10 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">I tuoi punti</p>
              <p className="mt-2 text-4xl font-black">{dashboard?.totalPoints ?? 0}</p>
              <p className="mt-2 text-xs text-gray-400">{completate} di {totaleMissioni} missioni completate</p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/30 text-4xl">🏆</div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`Progresso missioni ${progresso}%`}>
            <motion.div animate={{ width: `${progresso}%` }} className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400" />
          </div>
        </motion.section>

        <section className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-300">Classifica live</p>
              <h2 className="mt-2 text-2xl font-black">Podio Top 3</h2>
            </div>
            <p className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
              La tua posizione: {dashboard?.myPosition ? `#${dashboard.myPosition}` : "—"}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {dashboard?.leaderboard.map((entry) => (
              <article key={`${entry.position}-${entry.participantId}`} className={`rounded-2xl border p-4 text-center ${entry.position === 1 ? "border-yellow-300/30 bg-yellow-300/10" : "border-white/10 bg-black/25"}`}>
                <p className="text-2xl" aria-label={`Posizione ${entry.position}`}>
                  {entry.position === 1 ? "🥇" : entry.position === 2 ? "🥈" : "🥉"}
                </p>
                <div className="mx-auto mt-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-900">
                  {entry.avatarUrl ? (
                    <Image src={entry.avatarUrl} alt={`Avatar di ${entry.nickname}`} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">👤</span>
                  )}
                </div>
                <h3 className="mt-3 truncate font-black">{entry.nickname}</h3>
                <p className="mt-1 text-sm font-black text-orange-300">{entry.points} punti</p>
              </article>
            ))}
          </div>

          {dashboard?.leaderboard.length === 0 && (
            <p className="mt-6 text-center text-sm text-gray-400">La classifica apparirà dopo i primi punti assegnati.</p>
          )}
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          {dashboard?.missions.map((missione, index) => (
            <motion.article key={missione.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className={`relative overflow-hidden rounded-[28px] border p-5 backdrop-blur-xl ${missione.completed ? "border-green-400/30 bg-green-400/10" : "border-white/10 bg-white/[0.05]"}`}>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-4xl">{missione.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">{missione.title}</h2>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-gray-300">{missione.difficulty}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-400">{missione.description}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <span className="text-sm font-black text-orange-300">+{missione.points} punti</span>
                <button type="button" onClick={() => void completaMissione(missione.id)} disabled={missione.completed || missione.verificationMode !== "automatic" || missioneInCorso !== null} className={`rounded-full px-4 py-2.5 text-xs font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${missione.completed ? "border border-green-400/30 bg-green-400/15 text-green-300" : "bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 text-white"}`}>
                  {missione.completed ? "COMPLETATA ✓" : missione.verificationMode !== "automatic" ? "DA CONFERMARE" : missioneInCorso === missione.id ? "SALVATAGGIO..." : "VERIFICA"}
                </button>
              </div>
            </motion.article>
          ))}
        </section>

        {dashboard && dashboard.missions.length === 0 && (
          <section className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.04] p-7 text-center text-gray-400">
            Nessuna missione disponibile per questo evento.
          </section>
        )}

        <section className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="text-center">
            <span className="text-4xl">🎁</span>
            <h2 className="mt-4 text-2xl font-black">Premi disponibili</h2>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {dashboard?.rewards.map((premio) => (
              <article key={premio.id} className={`rounded-2xl border p-4 ${premio.available ? "border-green-400/30 bg-green-400/10" : "border-white/10 bg-black/25"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{premio.title}</h3>
                    {premio.description && <p className="mt-2 text-sm leading-6 text-gray-400">{premio.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-xs font-black text-orange-300">
                    {premio.rewardType === "podium_position" ? `Podio #${premio.podiumPosition}` : `${premio.pointsRequired} pt`}
                  </span>
                </div>
                <p className={`mt-3 text-xs font-black uppercase tracking-wider ${premio.claimed ? "text-gray-400" : premio.available ? "text-green-300" : "text-gray-500"}`}>
                  {premio.claimed ? "Già assegnato" : premio.quantityRemaining <= 0 ? "Esaurito" : premio.available ? "Sbloccato" : "Da sbloccare"}
                </p>
                {premio.available && !premio.claimed && (
                  <button type="button" disabled={premioInCorso !== null} onClick={() => void riscattaPremio(premio.id)} className="mt-4 w-full rounded-xl bg-green-400 px-4 py-3 text-sm font-black text-black disabled:opacity-60">
                    {premioInCorso === premio.id ? "RISCATTO..." : `RISCATTA${premio.pointsCost ? ` · ${premio.pointsCost} PT` : ""}`}
                  </button>
                )}
              </article>
            ))}
          </div>
          {dashboard?.rewards.length === 0 && <p className="mt-5 text-center text-sm text-gray-400">Nessun premio configurato per questo evento.</p>}
        </section>
      </div>
    </main>
  )
}
