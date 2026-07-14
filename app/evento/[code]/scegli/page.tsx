"use client"

import { useParams, useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"

type SceltaId = "match" | "social" | "missioni"

type Scelta = {
  id: SceltaId
  icon: string
  step: string
  title: string
  description: string
  action: string
}

const scelte: Scelta[] = [
  {
    id: "match",
    icon: "❤️",
    step: "AFFINITÀ",
    title: "Trova un match",
    description:
      "Scopri le persone con cui condividi maggiore compatibilità e intenzioni.",
    action: "Scopri i match",
  },
  {
    id: "social",
    icon: "🤝",
    step: "CONNESSIONI",
    title: "Conosci nuove persone",
    description:
      "Trova qualcuno con cui parlare, ballare o creare un nuovo gruppo.",
    action: "Inizia a socializzare",
  },
  {
    id: "missioni",
    icon: "🎯",
    step: "ESPERIENZE",
    title: "Missioni e premi",
    description:
      "Completa sfide sociali durante la serata, guadagna punti e prova a vincere.",
    action: "Apri le missioni",
  },
]

export default function ScegliEsperienzaPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  function seleziona(scelta: SceltaId) {
    localStorage.setItem("zocyal_activity", scelta)

    if (scelta === "match") {
      router.push(`/evento/${params.code}/compatibilita`)
      return
    }

    if (scelta === "social") {
      router.push(`/evento/${params.code}/compatibilita`)
      return
    }

    alert(
      "La sezione Missioni e premi verrà collegata nel prossimo passaggio."
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
            Terzo passo
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Cosa vuoi fare adesso?
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Scegli come vivere la serata. Potrai cambiare esperienza anche più
            avanti.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {scelte.map((scelta, index) => (
            <button
              key={scelta.id}
              type="button"
              onClick={() => seleziona(scelta.id)}
              className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-[1px] text-left shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-pink-400/50"
            >
              <div className="relative rounded-[23px] bg-zinc-950/90 p-6">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/70 to-transparent opacity-0 transition group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-12 shrink-0 items-center justify-center text-4xl">
                      {scelta.icon}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-400">
                          {scelta.step}
                        </p>

                        {index === 0 && (
                          <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-pink-300">
                            Consigliato
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2 text-xl font-black text-white transition group-hover:text-pink-300">
                        {scelta.title}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-gray-400">
                        {scelta.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-sm font-bold text-gray-300 transition group-hover:text-white">
                    {scelta.action}
                  </span>

                  <span className="text-2xl text-white/30 transition duration-300 group-hover:translate-x-1 group-hover:text-pink-300">
                    ›
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center backdrop-blur">
          <p className="text-xs leading-5 text-gray-500">
            La tua scelta serve a personalizzare ciò che Zocyal ti mostrerà
            durante l&apos;evento.
          </p>
        </div>
      </div>
    </main>
  )
}