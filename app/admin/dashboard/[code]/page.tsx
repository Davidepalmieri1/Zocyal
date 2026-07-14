"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import StatCard from "@/app/admin/components/StatCard"
import ActivityFeed from "@/app/admin/components/ActivityFeed"
import EventQR from "@/app/admin/components/EventQR"

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

export default function DashboardEventoPage() {
  const params = useParams<{ code: string }>()
  const code = params.code

  const [evento, setEvento] = useState<any>(null)
  const [partecipanti, setPartecipanti] = useState<Partecipante[]>([])
  const [totMatch, setTotMatch] = useState(0)
  const [totMessaggi, setTotMessaggi] = useState(0)
  const [activities, setActivities] = useState<Attivita[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")

  function aggiungiAttivita(activity: Attivita) {
    setActivities((old) => [activity, ...old].slice(0, 10))
  }

  async function caricaDashboard() {
    if (!code) {
      return
    }

    setLoading(true)
    setErrore("")

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("code", code)
      .maybeSingle()

    if (eventError) {
      console.error("Errore caricamento evento:", eventError)
      setErrore("Impossibile caricare l’evento.")
      setLoading(false)
      return
    }

    if (!eventData) {
      setErrore("Evento non trovato.")
      setLoading(false)
      return
    }

    setEvento(eventData)

    const { data: users, error: usersError } = await supabase
      .from("participants")
      .select("*")
      .eq("event_code", code)

    if (usersError) {
      console.error("Errore caricamento partecipanti:", usersError)
      setErrore("Impossibile caricare i partecipanti.")
      setLoading(false)
      return
    }

    const listaUtenti = (users || []) as Partecipante[]

    setPartecipanti(listaUtenti)
    setTotMatch(0)
    setTotMessaggi(0)

    const userIds = listaUtenti.map((user) => user.id)

    if (userIds.length > 0) {
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(
          `user_one.in.(${userIds.join(",")}),user_two.in.(${userIds.join(",")})`
        )

      if (matchesError) {
        console.error("Errore caricamento match:", matchesError)
      }

      const listaMatch = matches || []

      setTotMatch(listaMatch.length)

      const matchIds = listaMatch.map((match) => match.id)

      if (matchIds.length > 0) {
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .in("match_id", matchIds)

        if (messagesError) {
          console.error("Errore caricamento messaggi:", messagesError)
        }

        setTotMessaggi(messages?.length || 0)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!code) {
      return
    }

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

          setPartecipanti((old) => {
            const esiste = old.some(
              (partecipante) => partecipante.id === nuovoPartecipante.id
            )

            if (esiste) {
              return old
            }

            return [...old, nuovoPartecipante]
          })

          aggiungiAttivita({
            id: `${Date.now()}-participant`,
            icon: "👤",
            title: "Nuovo partecipante",
            description: `${
              nuovoPartecipante.nickname || "Utente"
            } è entrato nell’evento`,
            time: new Date().toLocaleTimeString([], {
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
            time: new Date().toLocaleTimeString([], {
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
            time: new Date().toLocaleTimeString([], {
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
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        Carico dashboard...
      </main>
    )
  }

  if (errore) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <h1 className="text-3xl font-bold text-pink-500">
            ZOCYAL
          </h1>

          <p className="mt-4 text-red-300">
            {errore}
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-10">
          <h1 className="text-5xl font-bold text-pink-500">
            🔥 ZOCYAL
          </h1>

          <h2 className="mt-3 text-3xl font-bold">
            {evento?.name || "Evento"}
          </h2>

          <p className="text-gray-400">
            📍 {evento?.venue || "Luogo non indicato"}
          </p>

          <div className="mt-4 inline-block rounded-full bg-green-500 px-4 py-2 font-bold text-black">
            🟢 Evento attivo
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="Partecipanti"
            value={partecipanti.length}
            icon="👥"
          />

          <StatCard
            title="Match creati"
            value={totMatch}
            icon="❤️"
          />

          <StatCard
            title="Messaggi"
            value={totMessaggi}
            icon="💬"
          />
        </div>

        <ActivityFeed activities={activities} />

        <section className="mt-10 rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <h2 className="text-2xl font-bold">
                QR dell&apos;evento
              </h2>

              <p className="mt-2 max-w-xl text-gray-400">
                Mostra questo QR agli ospiti. Scansionandolo entreranno
                direttamente nell&apos;evento corretto.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-gray-400">
                  Codice evento
                </p>

                <p className="mt-1 text-xl font-bold text-pink-400">
                  {code}
                </p>
              </div>
            </div>

            <div className="w-full max-w-md">
              <EventQR
                code={code}
                name={evento?.name || "Evento Zocyal"}
                venue={evento?.venue || ""}
              />
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl">
          <h2 className="mb-6 text-2xl font-bold">
            👥 Partecipanti evento
          </h2>

          {partecipanti.length === 0 ? (
            <p className="text-gray-400">
              Nessun partecipante è ancora entrato.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {partecipanti.map((persona) => (
                <div
                  key={persona.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 text-black transition hover:scale-[1.02]"
                >
                  {persona.avatar_url ? (
                    <img
                      src={persona.avatar_url}
                      alt={persona.nickname || "Partecipante"}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-2xl">
                      👤
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold">
                      {persona.nickname || "Partecipante"}
                    </h3>

                    <p>
                      {persona.age ? `${persona.age} anni` : "Età non indicata"}
                    </p>

                    <p className="text-sm text-gray-500">
                      {persona.goal || "Obiettivo non indicato"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}