"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

type PersonaMatch = {
  id: string
  nickname: string | null
  age: number | null
  avatar_url: string | null
  goal: string | null
  match_id: string
  status: string
  ultimo_messaggio: string | null
  ultimo_messaggio_ora: string | null
  ultimo_messaggio_mio: boolean
  non_letti: number
}

type MatchRecord = {
  id: string
  user_one: string
  user_two: string
  status: string | null
  created_at: string | null
}

type PersonaRecord = {
  id: string
  nickname: string | null
  age: number | null
  avatar_url: string | null
  goal: string | null
}

type MessaggioRecord = {
  id: string
  match_id: string
  sender_id: string
  message: string
  created_at: string
  read_at: string | null
}

export default function MieiMatchPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [matches, setMatches] = useState<PersonaMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")
  const [filtro, setFiltro] = useState<"tutte" | "non-lette">("tutte")

  useEffect(() => {
    async function caricaChat() {
      const mioId = localStorage.getItem("participant_id")

      if (!mioId) {
        setErrore("Profilo non trovato.")
        setLoading(false)
        return
      }

      setLoading(true)
      setErrore("")

      const { data: mieiMatch, error: matchError } = await supabase
        .from("matches")
        .select("id, user_one, user_two, status, created_at")
        .or(`user_one.eq.${mioId},user_two.eq.${mioId}`)
        .order("created_at", {
          ascending: false,
        })

      if (matchError) {
        console.error("Errore caricamento chat:", matchError)
        setErrore("Non siamo riusciti a caricare le tue chat.")
        setLoading(false)
        return
      }

      const matchRecords = (mieiMatch || []) as MatchRecord[]

      if (matchRecords.length === 0) {
        setMatches([])
        setLoading(false)
        return
      }

      const altriIds = Array.from(
        new Set(
          matchRecords.map((match) =>
            match.user_one === mioId
              ? match.user_two
              : match.user_one
          )
        )
      )

      const matchIds = matchRecords.map((match) => match.id)

      const [personeResult, messaggiResult] = await Promise.all([
        supabase
          .from("participants")
          .select("id, nickname, age, avatar_url, goal")
          .in("id", altriIds),

        supabase
          .from("messages")
          .select("id, match_id, sender_id, message, created_at, read_at")
          .in("match_id", matchIds)
          .order("created_at", {
            ascending: false,
          }),
      ])

      if (personeResult.error) {
        console.error(
          "Errore caricamento partecipanti:",
          personeResult.error
        )
      }

      if (messaggiResult.error) {
        console.error(
          "Errore caricamento ultimi messaggi:",
          messaggiResult.error
        )
      }

      const persone =
        (personeResult.data || []) as PersonaRecord[]

      const messaggi =
        (messaggiResult.data || []) as MessaggioRecord[]

      const personePerId = new Map(
        persone.map((persona) => [persona.id, persona])
      )

      const ultimoMessaggioPerMatch =
        new Map<string, MessaggioRecord>()

      for (const messaggio of messaggi) {
        if (!ultimoMessaggioPerMatch.has(messaggio.match_id)) {
          ultimoMessaggioPerMatch.set(
            messaggio.match_id,
            messaggio
          )
        }
      }

      const lista: PersonaMatch[] = matchRecords
        .map((match) => {
          const altroId =
            match.user_one === mioId
              ? match.user_two
              : match.user_one

          const persona = personePerId.get(altroId)
          const ultimoMessaggio =
            ultimoMessaggioPerMatch.get(match.id)

          if (!persona) {
            return null
          }

          return {
            ...persona,
            match_id: match.id,
            status: match.status || "matched",
            ultimo_messaggio:
              ultimoMessaggio?.message || null,
            ultimo_messaggio_ora:
              ultimoMessaggio?.created_at || null,
            ultimo_messaggio_mio:
              ultimoMessaggio?.sender_id === mioId,
            non_letti: messaggi.filter(
              (messaggio) =>
                messaggio.match_id === match.id &&
                messaggio.sender_id !== mioId &&
                !messaggio.read_at
            ).length,
          }
        })
        .filter(
          (item): item is PersonaMatch => item !== null
        )
        .sort((a, b) => {
          const dataA = a.ultimo_messaggio_ora
            ? new Date(a.ultimo_messaggio_ora).getTime()
            : 0

          const dataB = b.ultimo_messaggio_ora
            ? new Date(b.ultimo_messaggio_ora).getTime()
            : 0

          return dataB - dataA
        })

      setMatches(lista)
      setLoading(false)
    }

    caricaChat()
  }, [])

  function formattaOrario(data: string | null) {
    if (!data) return ""

    const messaggio = new Date(data)
    const oggi = new Date()

    const stessaGiornata =
      messaggio.getDate() === oggi.getDate() &&
      messaggio.getMonth() === oggi.getMonth() &&
      messaggio.getFullYear() === oggi.getFullYear()

    if (stessaGiornata) {
      return messaggio.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    return messaggio.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
    })
  }

  if (loading) {
    return (
      <main className="premium-page relative flex min-h-screen items-center justify-center overflow-hidden px-6 text-white">
        <PremiumBackdrop orbs={false} />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <h1 className="mt-6 text-2xl font-black">
            Carico le tue chat
          </h1>

          <p className="mt-3 text-gray-400">
            Prepariamo il quadro della serata.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="premium-page relative min-h-screen overflow-hidden px-5 py-8 text-white sm:py-10">
      <PremiumBackdrop orbs={false} />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="premium-eyebrow">
            Centro conversazioni
          </p>

          <h1 className="premium-title mt-3 text-4xl font-black">
            Le tue connessioni.
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Tutti i match e le conversazioni della serata,
            ordinati dall’ultimo messaggio.
          </p>
        </div>

        {errore && (
          <p className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {errore}
          </p>
        )}

        {matches.length === 0 ? (
          <section className="premium-glass premium-enter mt-8 rounded-[2rem] p-8 text-center">
            <span className="text-5xl">💬</span>

            <h2 className="mt-5 text-2xl font-black">
              Nessuna chat ancora
            </h2>

            <p className="mt-3 leading-7 text-gray-400">
              Quando nasce un match, la conversazione comparirà qui.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/evento/${params.code}/compatibilita`
                )
              }
              className="mt-7 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)]"
            >
              SCOPRI LE AFFINITÀ
            </button>
          </section>
        ) : (
          <div className="mt-8 flex flex-col gap-3">
            <div className="mb-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5">
              {([['tutte', 'Tutte'], ['non-lette', 'Da leggere']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFiltro(value)}
                  className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${filtro === value ? 'bg-white text-black' : 'text-white/45 hover:text-white'}`}
                >
                  {label}{value === 'non-lette' ? ` · ${matches.filter((item) => item.non_letti > 0).length}` : ''}
                </button>
              ))}
            </div>

            {matches.filter((persona) => filtro === "tutte" || persona.non_letti > 0).map((persona) => {
              const bloccata =
                persona.status === "blocked"

              return (
                <button
                  key={persona.match_id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/evento/${params.code}/chat/${persona.match_id}`
                    )
                  }
                  className="premium-glass premium-enter group flex w-full items-center gap-4 rounded-[1.65rem] p-4 text-left transition hover:-translate-y-0.5 hover:border-pink-400/30"
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

                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="truncate text-lg font-black text-white">
                        {persona.nickname ||
                          "Partecipante"}
                      </h2>

                      <div className="flex shrink-0 items-center gap-2">
                        {persona.non_letti > 0 && !bloccata && (
                          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-pink-500 px-2 text-[10px] font-black text-white">
                            {persona.non_letti > 99
                              ? "99+"
                              : persona.non_letti}
                          </span>
                        )}

                        <span className="text-[11px] font-bold text-gray-500">
                          {formattaOrario(
                            persona.ultimo_messaggio_ora
                          )}
                        </span>
                      </div>
                    </div>

                    {bloccata ? (
                      <p className="mt-1 truncate text-sm font-bold text-red-300">
                        🛡️ Conversazione bloccata
                      </p>
                    ) : persona.ultimo_messaggio ? (
                      <p
                        className={`mt-1 truncate text-sm ${
                          persona.non_letti > 0
                            ? "font-black text-white"
                            : "text-gray-400"
                        }`}
                      >
                        {persona.ultimo_messaggio_mio
                          ? "Tu: "
                          : ""}
                        {persona.ultimo_messaggio}
                      </p>
                    ) : (
                      <p className="mt-1 truncate text-sm text-pink-300">
                        Nuovo match. Rompi il ghiaccio ✨
                      </p>
                    )}

                    {persona.goal && !bloccata && (
                      <p className="mt-2 truncate text-[11px] font-semibold text-gray-600">
                        {persona.goal}
                      </p>
                    )}
                  </div>

                  <span className="text-2xl text-white/20 transition group-hover:translate-x-1 group-hover:text-pink-300">
                    ›
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
