"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import ActivityFeed from "@/app/admin/components/ActivityFeed"
import EventQR from "@/app/admin/components/EventQR"
import Logo from "@/app/components/Logo"

type Evento = {
  name: string | null
  venue: string | null
  code: string
}

type Partecipante = {
  id: string
  nickname: string | null
  age: number | null
  goal: string | null
  avatar_url: string | null
}

type Attivita = {
  id: string
  icon: string
  title: string
  description: string
  time: string
}

type StatCardProps = {
  title: string
  value: number
  icon: string
  description: string
}

function DashboardStatCard({
  title,
  value,
  icon,
  description,
}: StatCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-pink-400/30">
      <div className="pointer-events-none absolute right-[-40px] top-[-40px] h-28 w-28 rounded-full bg-pink-500/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">
            {title}
          </p>

          <p className="mt-3 text-5xl font-black tracking-tight text-white">
            {value}
          </p>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            {description}
          </p>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-600/20 via-pink-500/15 to-orange-400/10 text-3xl">
          {icon}
        </div>
      </div>
    </article>
  )
}

export default function DashboardEventoPage() {
  const params = useParams<{ code: string }>()
  const code = params.code.trim().toLowerCase()

  const [evento, setEvento] = useState<Evento | null>(null)
  const [partecipanti, setPartecipanti] = useState<Partecipante[]>([])
  const [totPartecipanti, setTotPartecipanti] = useState(0)
  const [totMatch, setTotMatch] = useState(0)
  const [totMessaggi, setTotMessaggi] = useState(0)
  const [totSegnalazioni, setTotSegnalazioni] = useState(0)
  const [activities, setActivities] = useState<Attivita[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")

  function aggiungiAttivita(activity: Attivita) {
    setActivities((old) => [activity, ...old].slice(0, 10))
  }

  async function caricaDashboard() {
    if (!code) return

    setLoading(true)
    setErrore("")

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("name, venue, code")
      .eq("code", code)
      .maybeSingle()

    if (eventError || !eventData) {
      console.error("Errore caricamento evento:", eventError)
      setErrore(
        eventError
          ? "Impossibile caricare l’evento."
          : "Evento non trovato."
      )
      setLoading(false)
      return
    }

    setEvento(eventData as Evento)

    const [idsResult, usersResult] = await Promise.all([
      supabase
        .from("participants")
        .select("id", { count: "exact" })
        .eq("event_code", code),
      supabase
        .from("participants")
        .select("id, nickname, age, goal, avatar_url")
        .eq("event_code", code)
        .limit(50),
    ])

    if (idsResult.error || usersResult.error) {
      console.error(
        "Errore caricamento partecipanti:",
        idsResult.error || usersResult.error
      )
      setErrore("Impossibile caricare i partecipanti.")
      setLoading(false)
      return
    }

    const listaUtenti = (usersResult.data || []) as Partecipante[]
    setPartecipanti(listaUtenti)
    setTotPartecipanti(idsResult.count || 0)

    const userIds = (idsResult.data || []).map((user) => user.id)

    if (userIds.length === 0) {
      setTotMatch(0)
      setTotMessaggi(0)
      setTotSegnalazioni(0)
      setLoading(false)
      return
    }

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id")
      .or(
        `user_one.in.(${userIds.join(",")}),user_two.in.(${userIds.join(",")})`
      )

    if (matchesError) {
      console.error("Errore caricamento match:", matchesError)
    }

    const listaMatch = matches || []
    const matchIds = listaMatch.map((match) => match.id)

    setTotMatch(listaMatch.length)

    if (matchIds.length > 0) {
      const [messagesResult, reportsResult] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("match_id", matchIds),

        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .in("match_id", matchIds)
          .eq("status", "open"),
      ])

      if (messagesResult.error) {
        console.error(
          "Errore caricamento messaggi:",
          messagesResult.error
        )
      }

      if (reportsResult.error) {
        console.error(
          "Errore caricamento segnalazioni:",
          reportsResult.error
        )
      }

      setTotMessaggi(messagesResult.count || 0)
      setTotSegnalazioni(reportsResult.count || 0)
    } else {
      setTotMessaggi(0)
      setTotSegnalazioni(0)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!code) return

    caricaDashboard()

    const channel = supabase
      .channel(`admin-live-${code}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `event_code=eq.${code}`,
        },
        (payload) => {
          const nuovoPartecipante = payload.new as Partecipante

          setTotPartecipanti((old) => old + 1)
          setPartecipanti((old) => {
            const esiste = old.some(
              (partecipante) =>
                partecipante.id === nuovoPartecipante.id
            )

            return esiste
              ? old
              : [nuovoPartecipante, ...old].slice(0, 50)
          })

          aggiungiAttivita({
            id: `${Date.now()}-participant`,
            icon: "👤",
            title: "Nuovo partecipante",
            description: `${
              nuovoPartecipante.nickname || "Utente"
            } è entrato nell’evento`,
            time: new Date().toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
        },
        () => {
          setTotMatch((old) => old + 1)

          aggiungiAttivita({
            id: `${Date.now()}-match`,
            icon: "❤️",
            title: "Nuovo match",
            description: "Due partecipanti hanno fatto match",
            time: new Date().toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          setTotMessaggi((old) => old + 1)

          aggiungiAttivita({
            id: `${Date.now()}-message`,
            icon: "💬",
            title: "Nuovo messaggio",
            description: "Nuova attività nella chat",
            time: new Date().toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reports",
        },
        () => {
          setTotSegnalazioni((old) => old + 1)

          aggiungiAttivita({
            id: `${Date.now()}-report`,
            icon: "🛡️",
            title: "Nuova segnalazione",
            description: "È richiesta una verifica di sicurezza",
            time: new Date().toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [code])

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <h1 className="mt-6 text-2xl font-black">
            Carico la dashboard
          </h1>

          <p className="mt-3 text-gray-400">
            Prepariamo il centro di controllo.
          </p>
        </div>
      </main>
    )
  }

  if (errore) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-center text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative w-full max-w-md">
          <Logo size="medium" />

          <div className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-7">
            <span className="text-5xl">⚠️</span>

            <h1 className="mt-4 text-2xl font-black">
              Dashboard non disponibile
            </h1>

            <p className="mt-3 leading-7 text-red-200">
              {errore}
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="relative min-w-0 flex-1 overflow-hidden px-5 pb-6 pt-20 lg:px-8 lg:py-8">
        <div className="pointer-events-none absolute left-[35%] top-[-220px] h-[520px] w-[520px] rounded-full bg-fuchsia-600/15 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-[-220px] right-[-120px] h-[420px] w-[420px] rounded-full bg-orange-500/10 blur-[130px]" />

        <div className="relative w-full max-w-7xl">
          <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-8">
            <div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Logo size="medium" />

                <p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-pink-400">
                  Centro di controllo evento
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  {evento?.name || "Evento"}
                </h1>

                <p className="mt-3 text-base text-gray-400">
                  📍 {evento?.venue || "Luogo non indicato"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                <div className="rounded-2xl border border-green-400/25 bg-green-400/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
                    Stato
                  </p>

                  <p className="mt-2 font-black text-white">
                    🟢 Evento attivo
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                    Codice evento
                  </p>

                  <p className="mt-2 text-xl font-black tracking-[0.12em] text-pink-300">
                    {code}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <DashboardStatCard
              title="Partecipanti"
              value={totPartecipanti}
              icon="👥"
              description="Persone entrate nell’evento."
            />

            <DashboardStatCard
              title="Match creati"
              value={totMatch}
              icon="❤️"
              description="Connessioni reciproche generate."
            />

            <DashboardStatCard
              title="Messaggi"
              value={totMessaggi}
              icon="💬"
              description="Messaggi scambiati nelle chat."
            />

            <DashboardStatCard
              title="Segnalazioni"
              value={totSegnalazioni}
              icon="🛡️"
              description="Richieste di sicurezza ancora aperte."
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-400">
                  Attività live
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Cosa sta succedendo
                </h2>
              </div>

              <ActivityFeed activities={activities} />
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-400">
                  Ingresso evento
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  QR dell&apos;evento
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-400">
                  Mostralo agli ospiti per portarli direttamente nella serata corretta.
                </p>
              </div>

              <div className="mt-5">
                <EventQR
                  code={code}
                  name={evento?.name || "Evento Zocyal"}
                  venue={evento?.venue || ""}
                />
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-400">
                  Persone presenti
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Partecipanti evento
                </h2>

                <p className="mt-2 text-sm text-gray-400">
                  {totPartecipanti} profili registrati. Mostriamo gli ultimi 50.
                </p>
              </div>

              <button
                type="button"
                onClick={caricaDashboard}
                className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
              >
                ↻ AGGIORNA DATI
              </button>
            </div>

            {partecipanti.length === 0 ? (
              <div className="mt-7 rounded-3xl border border-white/10 bg-black/25 p-8 text-center">
                <span className="text-5xl">👥</span>

                <p className="mt-4 font-black text-white">
                  Nessun partecipante ancora
                </p>

                <p className="mt-2 text-sm text-gray-400">
                  I nuovi ingressi compariranno qui in tempo reale.
                </p>
              </div>
            ) : (
              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {partecipanti.map((persona) => (
                  <article
                    key={persona.id}
                    className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-0.5 hover:border-pink-400/30 hover:bg-white/[0.06]"
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-900">
                        {persona.avatar_url ? (
                          <img
                            src={persona.avatar_url}
                            alt={
                              persona.nickname ||
                              "Partecipante"
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">👤</span>
                        )}
                      </div>

                      <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-black bg-green-400" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black text-white">
                        {persona.nickname || "Partecipante"}
                      </h3>

                      <p className="mt-1 text-sm text-gray-400">
                        {persona.age
                          ? `${persona.age} anni`
                          : "Età non indicata"}
                      </p>

                      <p className="mt-1 truncate text-xs font-semibold text-pink-300">
                        {persona.goal ||
                          "Obiettivo non indicato"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
