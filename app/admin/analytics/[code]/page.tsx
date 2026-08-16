"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { fetchAdminData } from "@/app/admin/data-client"

type DanceStatus = {
  pending: number
  accepted: number
  declined: number
  later: number
  cancelled: number
  expired: number
}

type DanceAnalytics = {
  profiles: number
  available: number
  invitations: number
  statuses: DanceStatus
  acceptanceRate: number
  averageResponseMinutes: number | null
  uniqueInviters: number
  uniqueReceivers: number
  engagedProfiles: number
  untouchedProfiles: number
  styles: { style: string; total: number; accepted: number }[]
  roles: { role: string; count: number }[]
  levels: { level: string; count: number }[]
  hourlyActivity: { hour: string; count: number }[]
}

type Analytics = {
  experienceMode: "standard" | "inclusive" | "caribbean"
  participants: number
  completedTests: number
  matches: number
  messages: number
  drinkOffers: number
  drinkAccepted: number
  drinkRedeemed: number
  dance: DanceAnalytics | null
}

const empty: Analytics = {
  experienceMode: "standard",
  participants: 0,
  completedTests: 0,
  matches: 0,
  messages: 0,
  drinkOffers: 0,
  drinkAccepted: 0,
  drinkRedeemed: 0,
  dance: null,
}

const STYLE_LABELS: Record<string, string> = {
  salsa_cubana: "Salsa cubana",
  salsa_portoricana: "Salsa portoricana",
  bachata: "Bachata",
  bachata_sensual: "Bachata Sensual",
  merengue: "Merengue",
  kizomba: "Kizomba",
  balli_di_gruppo: "Balli di gruppo",
}

const ROLE_LABELS: Record<string, string> = {
  leader: "Leader",
  follower: "Follower",
  both: "Entrambi",
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato",
}

const percent = (value: number, total: number) => total ? Math.round((value / total) * 100) : 0

function MetricCard({ title, value, note, accent = "text-pink-300" }: { title: string; value: string | number; note: string; accent?: string }) {
  return <article className="premium-card-lift premium-glass rounded-[1.75rem] p-5 sm:p-6">
    <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">{title}</p>
    <p className={`mt-7 text-4xl font-black sm:text-5xl ${accent}`}>{value}</p>
    <p className="mt-2 text-xs leading-5 text-white/35">{note}</p>
  </article>
}

export default function AnalyticsPage() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [data, setData] = useState<Analytics>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setData(await fetchAdminData<Analytics>("analytics", code))
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore inatteso.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [code])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true)
    }, 30000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [load])

  const profileRate = percent(data.completedTests, data.participants)
  const drinkRate = percent(data.drinkAccepted, data.drinkOffers)
  const redeemRate = percent(data.drinkRedeemed, data.drinkAccepted)
  const danceProfileRate = percent(data.dance?.profiles || 0, data.participants)
  const maxStyle = Math.max(1, ...(data.dance?.styles.map((item) => item.total) || []))
  const maxHourly = Math.max(1, ...(data.dance?.hourlyActivity.map((item) => item.count) || []))

  const generalCards = useMemo(() => [
    { title: "Partecipanti", value: data.participants, note: `${profileRate}% ha completato il test` },
    { title: "Match creati", value: data.matches, note: `${data.participants ? (data.matches / data.participants).toFixed(1) : "0"} per partecipante` },
    { title: "Messaggi", value: data.messages, note: "Conversazioni generate" },
    { title: "Drink offerti", value: data.drinkOffers, note: `${drinkRate}% accettati` },
  ], [data.drinkOffers, data.matches, data.messages, data.participants, drinkRate, profileRate])

  return <div className="flex min-h-screen bg-[#050306] text-white">
    <Sidebar />
    <main className="relative min-w-0 flex-1 overflow-hidden px-4 pb-10 pt-20 sm:px-6 lg:p-8">
      <PremiumBackdrop orbs={false} />
      <div className="relative mx-auto max-w-7xl">
        <header className="border-b border-white/[.07] pb-7">
          <p className="premium-eyebrow">Live intelligence</p>
          <h1 className="premium-title mt-3 text-4xl font-black sm:text-6xl">Impatto della serata.</h1>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-white/45">Evento <strong className="text-pink-300">{code}</strong> · dati aggregati live</p>
            <button type="button" onClick={() => void load(true)} aria-label="Aggiorna analytics" className="rounded-xl border border-white/10 px-4 py-3 text-lg font-black text-white/55">↻</button>
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</p>}

        {loading ? <div className="mt-6 h-64 animate-pulse rounded-[2rem] bg-white/[.04]" /> : <>
          <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {generalCards.map((card) => <MetricCard key={card.title} {...card} />)}
          </section>

          {data.experienceMode === "caribbean" && data.dance && <section className="mt-8" aria-labelledby="dance-analytics-title">
            <div className="overflow-hidden rounded-[2rem] border border-pink-300/20 bg-gradient-to-br from-pink-500/15 via-white/[.04] to-orange-400/10 p-6 sm:p-8">
              <p className="premium-eyebrow">Analytics pista</p>
              <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <h2 id="dance-analytics-title" className="text-3xl font-black sm:text-4xl">Come si muove la pista.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Dati anonimi e aggregati su profili, inviti, stili e partecipazione.</p>
                </div>
                <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-200">{data.dance.available} DISPONIBILI ORA</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard title="Profili di ballo" value={data.dance.profiles} note={`${danceProfileRate}% dei partecipanti`} accent="text-pink-200" />
              <MetricCard title="Inviti inviati" value={data.dance.invitations} note={`${data.dance.uniqueInviters} persone hanno invitato`} accent="text-orange-200" />
              <MetricCard title="Tasso accettazione" value={`${data.dance.acceptanceRate}%`} note="Su inviti con risposta" accent="text-emerald-200" />
              <MetricCard title="Tempo di risposta" value={data.dance.averageResponseMinutes === null ? "—" : `${data.dance.averageResponseMinutes}m`} note="Media degli inviti risposti" accent="text-sky-200" />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <article className="premium-glass rounded-[2rem] p-6 sm:p-8">
                <p className="premium-eyebrow">Esito degli inviti</p>
                <h3 className="mt-2 text-2xl font-black">Dal primo passo alla risposta.</h3>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Accettati", data.dance.statuses.accepted, "text-emerald-200"],
                    ["In attesa", data.dance.statuses.pending, "text-orange-200"],
                    ["Rifiutati", data.dance.statuses.declined, "text-pink-200"],
                    ["Più tardi", data.dance.statuses.later, "text-sky-200"],
                    ["Annullati", data.dance.statuses.cancelled, "text-white/55"],
                    ["Scaduti", data.dance.statuses.expired, "text-white/35"],
                  ].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/35">{label}</p>
                    <p className={`mt-3 text-3xl font-black ${color}`}>{value}</p>
                  </div>)}
                </div>
              </article>

              <article className="premium-glass rounded-[2rem] p-6 sm:p-8">
                <p className="premium-eyebrow">Partecipazione</p>
                <h3 className="mt-2 text-2xl font-black">Coinvolgimento della community.</h3>
                <div className="mt-6 space-y-5">
                  {[
                    ["Profili coinvolti", data.dance.engagedProfiles, data.dance.profiles],
                    ["Persone che hanno invitato", data.dance.uniqueInviters, data.dance.profiles],
                    ["Persone che hanno ricevuto", data.dance.uniqueReceivers, data.dance.profiles],
                  ].map(([label, value, total]) => {
                    const rate = percent(Number(value), Number(total))
                    return <div key={String(label)}>
                      <div className="flex justify-between gap-3 text-sm"><span className="font-bold text-white/55">{label}</span><strong>{value} · {rate}%</strong></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-orange-400" style={{ width: `${rate}%` }} /></div>
                    </div>
                  })}
                </div>
                <p className="mt-6 rounded-2xl border border-white/[.08] bg-black/20 p-4 text-sm text-white/45"><strong className="text-white">{data.dance.untouchedProfiles}</strong> profili non hanno ancora inviato né ricevuto inviti.</p>
              </article>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="premium-glass rounded-[2rem] p-6 sm:p-8">
                <p className="premium-eyebrow">Preferenze della pista</p>
                <h3 className="mt-2 text-2xl font-black">Stili più richiesti.</h3>
                <div className="mt-6 space-y-4">
                  {data.dance.styles.map((item) => <div key={item.style}>
                    <div className="flex items-end justify-between gap-4"><div><p className="font-black">{STYLE_LABELS[item.style] || item.style}</p><p className="text-xs text-white/35">{item.accepted} inviti accettati</p></div><strong>{item.total}</strong></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400" style={{ width: `${Math.round((item.total / maxStyle) * 100)}%` }} /></div>
                  </div>)}
                  {!data.dance.styles.length && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/35">Gli stili compariranno dopo il primo invito.</p>}
                </div>
              </article>

              <article className="premium-glass rounded-[2rem] p-6 sm:p-8">
                <p className="premium-eyebrow">Composizione</p>
                <h3 className="mt-2 text-2xl font-black">Ruoli e livelli dichiarati.</h3>
                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-wider text-white/35">Ruoli</p>
                  <div className="mt-3 flex flex-wrap gap-2">{data.dance.roles.map((item) => <span key={item.role} className="rounded-full border border-pink-300/20 bg-pink-300/10 px-4 py-2 text-sm font-bold text-pink-100">{ROLE_LABELS[item.role] || item.role} · {item.count}</span>)}</div>
                </div>
                <div className="mt-7">
                  <p className="text-xs font-black uppercase tracking-wider text-white/35">Livelli selezionati</p>
                  <div className="mt-3 flex flex-wrap gap-2">{data.dance.levels.map((item) => <span key={item.level} className="rounded-full border border-orange-300/20 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-100">{LEVEL_LABELS[item.level] || item.level} · {item.count}</span>)}</div>
                </div>
              </article>
            </div>

            <article className="premium-glass mt-4 rounded-[2rem] p-6 sm:p-8">
              <p className="premium-eyebrow">Ritmo della serata</p>
              <h3 className="mt-2 text-2xl font-black">Inviti per fascia oraria.</h3>
              <div className="mt-7 flex min-h-48 items-end gap-2 overflow-x-auto pb-2">
                {data.dance.hourlyActivity.map((item) => <div key={item.hour} className="flex min-w-14 flex-1 flex-col items-center justify-end gap-2">
                  <strong className="text-xs text-orange-100">{item.count}</strong>
                  <div className="w-full rounded-t-xl bg-gradient-to-t from-pink-600 to-orange-300" style={{ height: `${Math.max(12, Math.round((item.count / maxHourly) * 140))}px` }} />
                  <span className="text-[10px] font-bold text-white/35">{item.hour}</span>
                </div>)}
                {!data.dance.hourlyActivity.length && <p className="m-auto text-sm text-white/35">L’andamento apparirà dopo il primo invito.</p>}
              </div>
            </article>
          </section>}

          <section className="premium-glass mt-6 rounded-[2rem] p-6 sm:p-8">
            <p className="premium-eyebrow">Conversioni generali</p>
            <h2 className="mt-2 text-2xl font-black">Dal profilo all’incontro.</h2>
            <div className="mt-7 grid gap-6 md:grid-cols-3">
              {[
                { label: "Profili match pronti", value: profileRate, color: "from-fuchsia-500 to-pink-400" },
                { label: "Drink accettati", value: drinkRate, color: "from-pink-500 to-orange-400" },
                { label: "Coupon utilizzati", value: redeemRate, color: "from-orange-400 to-amber-300" },
              ].map((item) => <div key={item.label}>
                <div className="flex items-end justify-between"><p className="text-sm font-bold text-white/60">{item.label}</p><p className="text-2xl font-black">{item.value}%</p></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className={`h-full rounded-full bg-gradient-to-r ${item.color}`} style={{ width: `${item.value}%` }} /></div>
              </div>)}
            </div>
          </section>
        </>}
      </div>
    </main>
  </div>
}
