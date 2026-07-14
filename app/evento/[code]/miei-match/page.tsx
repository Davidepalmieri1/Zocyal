"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"

type PersonaMatch = {
  id: string
  nickname: string | null
  age: number | null
  avatar_url: string | null
  goal: string | null
  match_id: string
}

export default function MieiMatchPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [matches, setMatches] = useState<PersonaMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")

  useEffect(() => {
    async function caricaMatch() {
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
        .select("*")
        .or(`user_one.eq.${mioId},user_two.eq.${mioId}`)
        .eq("status", "matched")
        .order("created_at", {
          ascending: false,
        })

      if (matchError) {
        console.error("Errore caricamento match:", matchError)
        setErrore("Non siamo riusciti a caricare i tuoi match.")
        setLoading(false)
        return
      }

      if (!mieiMatch || mieiMatch.length === 0) {
        setMatches([])
        setLoading(false)
        return
      }

      const lista: PersonaMatch[] = []

      for (const match of mieiMatch) {
        const altroId =
          match.user_one === mioId
            ? match.user_two
            : match.user_one

        const { data: persona, error: personaError } = await supabase
          .from("participants")
          .select("id, nickname, age, avatar_url, goal")
          .eq("id", altroId)
          .maybeSingle()

        if (personaError) {
          console.error(
            "Errore caricamento partecipante:",
            personaError
          )
          continue
        }

        if (persona) {
          lista.push({
            ...persona,
            match_id: match.id,
          })
        }
      }

      setMatches(lista)
      setLoading(false)
    }

    caricaMatch()
  }, [])

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <h1 className="mt-6 text-2xl font-black">
            Carico i tuoi match
          </h1>

          <p className="mt-3 text-gray-400">
            Stiamo recuperando le tue connessioni.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            Le tue connessioni
          </p>

          <h1 className="mt-3 text-3xl font-black">
            I tuoi match
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Qui trovi tutte le persone con cui l’interesse è reciproco.
          </p>
        </div>

        {errore && (
          <p className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {errore}
          </p>
        )}

        {matches.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <span className="text-5xl">
              ❤️
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Nessun match ancora
            </h2>

            <p className="mt-3 leading-7 text-gray-400">
              Continua a esplorare le affinità. Quando l’interesse sarà
              reciproco, il match comparirà qui.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(`/evento/${params.code}/compatibilita`)
              }
              className="mt-7 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02]"
            >
              SCOPRI LE AFFINITÀ
            </button>
          </section>
        ) : (
          <div className="mt-8 flex flex-col gap-5">
            {matches.map((persona) => (
              <article
                key={persona.match_id}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
              >
                <div className="relative h-64 overflow-hidden bg-zinc-900">
                  {persona.avatar_url ? (
                    <img
                      src={persona.avatar_url}
                      alt={persona.nickname || "Partecipante"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-7xl">
                        👤
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                  <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-4 py-2 text-xs font-black text-white shadow-lg">
                    MATCH
                  </div>

                  <div className="absolute bottom-5 left-5 right-5">
                    <h2 className="text-3xl font-black">
                      {persona.nickname || "Partecipante"}
                    </h2>

                    <p className="mt-1 text-sm text-gray-300">
                      {persona.age
                        ? `${persona.age} anni`
                        : "Età non indicata"}
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  {persona.goal && (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">
                        Obiettivo della serata
                      </p>

                      <p className="mt-2 font-bold text-gray-200">
                        {persona.goal}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/evento/${params.code}/chat/${persona.match_id}`
                      )
                    }
                    className="mt-5 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02] active:scale-[0.99]"
                  >
                    💬 APRI LA CHAT
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}