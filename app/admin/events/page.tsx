"use client"

import { useEffect, useState } from "react"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

type EventItem = {
  code: string
  name: string
  venue: string | null
  status: "draft" | "open" | "closed"
  starts_at: string | null
  ends_at: string | null
}

const labels = { draft: "BOZZA", open: "APERTO", closed: "TERMINATO" }

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void fetch("/admin/api/events", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        setEvents(body.events || [])
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Errore inatteso."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="premium-page px-4 py-8 text-white sm:px-7 lg:py-12">
      <PremiumBackdrop orbs={false} />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="premium-enter">
            <Logo size="medium" className="!items-start" />
            <p className="premium-eyebrow mt-6">Control room</p>
            <h1 className="premium-title mt-3 text-5xl font-black sm:text-6xl">I tuoi eventi.</h1>
            <p className="mt-4 max-w-lg text-white/45">Crea, apri e controlla ogni esperienza Zocyal da un unico spazio.</p>
          </div>
          <div className="premium-enter premium-enter-delay-1 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <a href="/admin/events/new" className="premium-cta rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-5 py-4 text-center text-sm font-black uppercase tracking-[.08em]">＋ Crea evento</a>
            <form action="/admin/api/logout" method="post"><button className="w-full rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4 text-sm font-black text-white/65 transition hover:bg-white/[.08] hover:text-white">ESCI</button></form>
          </div>
        </header>

        {error && <p className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}
        {loading && <div className="premium-glass mt-10 h-56 animate-pulse rounded-[2rem]" aria-label="Caricamento eventi" />}

        {!loading && !error && (
          <section className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event, index) => (
              <article key={event.code} className="premium-glass premium-card-lift premium-enter relative overflow-hidden rounded-[2rem] p-6" style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}>
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/45 to-transparent" />
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/30">Evento · {event.code}</p><h2 className="mt-3 text-2xl font-black tracking-tight">{event.name}</h2></div>
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black tracking-wider ${event.status === "open" ? "bg-emerald-400/12 text-emerald-300" : event.status === "draft" ? "bg-amber-400/12 text-amber-300" : "bg-white/[.06] text-white/45"}`}>{labels[event.status]}</span>
                </div>
                <div className="mt-8 border-t border-white/[.07] pt-5"><p className="text-sm text-white/55">⌖ {event.venue || "Luogo non indicato"}</p><p className="mt-2 text-xs text-white/30">{event.starts_at ? new Date(event.starts_at).toLocaleString("it-IT") : "Apertura non impostata"}</p></div>
                {event.code === "test" && <p className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/[.07] p-3 text-[10px] font-black uppercase tracking-wider text-sky-300">Ambiente di prova</p>}
                <div className="mt-6 grid grid-cols-[1fr_auto] gap-2"><a href={`/admin/dashboard/${event.code}`} className="rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-black transition hover:bg-pink-100">GESTISCI</a><a href={`/admin/impostazioni/${event.code}`} aria-label={`Impostazioni ${event.name}`} className="flex w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[.035] text-lg transition hover:border-pink-300/30 hover:bg-pink-400/10">⚙</a></div>
              </article>
            ))}
            {events.length === 0 && <div className="premium-glass rounded-[2rem] p-10 text-center text-white/45 md:col-span-2 xl:col-span-3">Nessun evento. Creane uno per iniziare.</div>}
          </section>
        )}
      </div>
    </main>
  )
}
