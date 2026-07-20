"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"

type PersonaSocial = {
  id: string
  nickname: string | null
  avatar_url: string | null
  age: number | null
  goal: string | null
}

export default function SocialPage() {
  const params = useParams<{
    code: string
  }>()

  const router = useRouter()

  const eventCode = params.code

  const [persone, setPersone] = useState<PersonaSocial[]>([])
  const [mioId, setMioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profiloControllato, setProfiloControllato] =
    useState(false)
  const [errore, setErrore] = useState("")

  useEffect(() => {
    async function caricaPersone() {
      setLoading(true)
      setErrore("")

      let participantId: string | null = null

      try {
        participantId = await resolveCurrentParticipant(eventCode)
      } catch (cause) {
        console.error("Errore identificazione profilo:", cause)
        setErrore("Non siamo riusciti a riconoscere il profilo attivo.")
      }

      setMioId(participantId)
      setProfiloControllato(true)

      if (!participantId) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("participants")
        .select(
          "id, nickname, avatar_url, age, goal"
        )
        .eq("event_code", eventCode)
        .neq("id", participantId)

      if (error) {
        console.error(
          "Errore caricamento persone:",
          error
        )

        setErrore(
          "Non siamo riusciti a caricare le persone presenti."
        )

        setLoading(false)
        return
      }

      setPersone((data || []) as PersonaSocial[])
      setLoading(false)
    }

    caricaPersone()
  }, [eventCode])

  function conosciPersona(personaId: string) {
    router.push(
      `/evento/${eventCode}/compatibilita?persona=${personaId}&mode=social`
    )
  }

  if (profiloControllato && !mioId) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative w-full max-w-md text-center">
          <Logo size="medium" />

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-8 backdrop-blur-xl">
            <span className="text-5xl">👤</span>

            <h1 className="mt-5 text-2xl font-black">
              Profilo non trovato
            </h1>

            <p className="mt-3 leading-7 text-gray-400">
              Entra nell’evento per conoscere nuove persone.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(`/evento/${eventCode}`)
              }
              className="mt-7 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white transition hover:scale-[1.02]"
            >
              TORNA ALL’EVENTO
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <h1 className="mt-6 text-2xl font-black">
            Cerco nuove persone
          </h1>

          <p className="mt-3 text-gray-400">
            Vediamo chi sta vivendo la serata.
          </p>
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
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Torna indietro"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl transition hover:border-pink-400/40 hover:bg-pink-500/10"
          >
            ‹
          </button>

          <Logo size="small" />
        </header>

        <section className="mt-10 text-center">
          <motion.div
            initial={{
              opacity: 0,
              y: 18,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.45,
            }}
          >
            <span className="inline-flex rounded-full border border-pink-400/20 bg-pink-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-pink-300">
              Modalità social
            </span>

            <h1 className="mt-5 text-4xl font-black sm:text-5xl">
              Conosci nuove persone
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
              Scopri chi è presente, trova qualcuno con cui
              parlare, ballare o fare gruppo.
            </p>
          </motion.div>
        </section>

        {errore && (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-300">
            {errore}
          </p>
        )}

        {persone.length === 0 ? (
          <motion.section
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            className="mx-auto mt-12 max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl"
          >
            <span className="text-5xl">🪩</span>

            <h2 className="mt-5 text-2xl font-black">
              Per ora sei il primo
            </h2>

            <p className="mt-3 leading-7 text-gray-400">
              Appena entreranno altre persone, compariranno qui.
            </p>
          </motion.section>
        ) : (
          <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {persone.map((persona, index) => (
              <motion.article
                key={persona.id}
                initial={{
                  opacity: 0,
                  y: 24,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: index * 0.07,
                  duration: 0.4,
                }}
                whileHover={{
                  y: -5,
                }}
                className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl transition hover:border-pink-400/35 hover:bg-white/[0.08]"
              >
                <div className="pointer-events-none absolute right-[-60px] top-[-60px] h-40 w-40 rounded-full bg-pink-500/10 blur-3xl" />

                <div className="relative">
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 shrink-0">
                      <div className="absolute inset-0 rounded-full bg-pink-500/30 blur-xl" />

                      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-900">
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
                          <span className="text-3xl">
                            👤
                          </span>
                        )}
                      </div>

                      <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-black bg-green-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-black">
                        {persona.nickname || "Partecipante"}
                      </h2>

                      {persona.age && (
                        <p className="mt-1 text-sm font-semibold text-gray-400">
                          {persona.age} anni
                        </p>
                      )}

                      {persona.goal && (
                        <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-[10px] font-bold text-pink-300">
                          {persona.goal}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                      Cerca durante la serata
                    </p>

                    <p className="mt-2 text-sm font-semibold leading-6 text-gray-300">
                      {persona.goal ||
                        "Conoscere nuove persone"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      conosciPersona(persona.id)
                    }
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-4 py-3.5 text-xs font-black text-white shadow-[0_0_25px_rgba(236,72,153,0.18)] transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    CONOSCI
                  </button>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
