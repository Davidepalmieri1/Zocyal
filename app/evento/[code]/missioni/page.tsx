"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useParams, useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"

type Missione = {
  id: string
  icon: string
  title: string
  description: string
  points: number
  difficulty: "Facile" | "Media" | "Difficile"
}

const missioni: Missione[] = [
  {
    id: "saluta",
    icon: "👋",
    title: "Rompi il ghiaccio",
    description:
      "Presentati a una persona che non conosci ancora.",
    points: 50,
    difficulty: "Facile",
  },
  {
    id: "foto",
    icon: "📸",
    title: "Foto di gruppo",
    description:
      "Scatta una foto con almeno tre persone conosciute durante la serata.",
    points: 100,
    difficulty: "Media",
  },
  {
    id: "ballo",
    icon: "🪩",
    title: "Porta qualcuno in pista",
    description:
      "Invita una nuova conoscenza a ballare con te.",
    points: 80,
    difficulty: "Media",
  },
  {
    id: "squadra",
    icon: "🤝",
    title: "Crea una squadra",
    description:
      "Forma un gruppo di quattro persone e completate una missione insieme.",
    points: 150,
    difficulty: "Difficile",
  },
]

export default function MissioniPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const eventCode = params.code

  const [missioniCompletate, setMissioniCompletate] =
    useState<string[]>([])

  const puntiTotali = missioni
    .filter((missione) =>
      missioniCompletate.includes(missione.id)
    )
    .reduce(
      (totale, missione) => totale + missione.points,
      0
    )

  function completaMissione(missioneId: string) {
    setMissioniCompletate((attuali) => {
      if (attuali.includes(missioneId)) {
        return attuali.filter(
          (id) => id !== missioneId
        )
      }

      return [...attuali, missioneId]
    })
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
          >
            <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
              Sfide della serata
            </span>

            <h1 className="mt-5 text-4xl font-black sm:text-5xl">
              Missioni e premi
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
              Completa le sfide, guadagna punti e vivi la
              serata in modo più coinvolgente.
            </p>
          </motion.div>
        </section>

        <motion.section
          initial={{
            opacity: 0,
            scale: 0.96,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          className="mx-auto mt-8 max-w-xl overflow-hidden rounded-[30px] border border-pink-400/20 bg-gradient-to-r from-fuchsia-600/15 via-pink-500/10 to-orange-400/10 p-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                I tuoi punti
              </p>

              <p className="mt-2 text-4xl font-black">
                {puntiTotali}
              </p>
            </div>

            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/30 text-4xl">
              🏆
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              animate={{
                width: `${Math.min(
                  (puntiTotali / 300) * 100,
                  100
                )}%`,
              }}
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400"
            />
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Raggiungi 300 punti per sbloccare il primo premio.
          </p>
        </motion.section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          {missioni.map((missione, index) => {
            const completata =
              missioniCompletate.includes(missione.id)

            return (
              <motion.article
                key={missione.id}
                initial={{
                  opacity: 0,
                  y: 24,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: index * 0.08,
                }}
                className={`relative overflow-hidden rounded-[28px] border p-5 backdrop-blur-xl transition ${
                  completata
                    ? "border-green-400/30 bg-green-400/10"
                    : "border-white/10 bg-white/[0.05]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-4xl">
                    {missione.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">
                        {missione.title}
                      </h2>

                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-gray-300">
                        {missione.difficulty}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      {missione.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <span className="text-sm font-black text-orange-300">
                    +{missione.points} punti
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      completaMissione(missione.id)
                    }
                    className={`rounded-full px-4 py-2.5 text-xs font-black transition active:scale-95 ${
                      completata
                        ? "border border-green-400/30 bg-green-400/15 text-green-300"
                        : "bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 text-white"
                    }`}
                  >
                    {completata
                      ? "COMPLETATA ✓"
                      : "COMPLETA"}
                  </button>
                </div>
              </motion.article>
            )
          })}
        </section>

        <section className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl">
          <span className="text-4xl">🎁</span>

          <h2 className="mt-4 text-2xl font-black">
            Premi in arrivo
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-400">
            I premi reali verranno collegati agli sponsor e agli
            organizzatori dell’evento.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/evento/${eventCode}/social`
              )
            }
            className="mt-6 rounded-full border border-pink-400/25 bg-pink-500/10 px-6 py-3 text-sm font-black text-pink-300 transition hover:border-pink-400/50 hover:bg-pink-500/15"
          >
            CONOSCI NUOVE PERSONE
          </button>
        </section>
      </div>
    </main>
  )
}