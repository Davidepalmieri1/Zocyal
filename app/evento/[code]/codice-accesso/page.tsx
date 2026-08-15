"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ensureAnonymousSession } from "@/app/lib/participant-session"
import Logo from "@/app/components/Logo"

export default function CodiceAccessoPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [codice, setCodice] = useState("")
  const [copiato, setCopiato] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")

  useEffect(() => {
    async function caricaCodice() {
      try {
        await ensureAnonymousSession()
      } catch (sessionError) {
        console.error("Errore sessione partecipante:", sessionError)
        setErrore("Sessione partecipante non disponibile.")
        setLoading(false)
        return
      }

      const participantId = localStorage.getItem("participant_id")
      const codiceSalvato = localStorage.getItem("recovery_code")
      const eventCode = params.code.trim().toLowerCase()
      const savedEventCode = localStorage.getItem("event_code")

      if (codiceSalvato && savedEventCode === eventCode) {
        setCodice(codiceSalvato)
        setLoading(false)
        return
      }

      if (!participantId) {
        setErrore("Profilo non trovato.")
        setLoading(false)
        return
      }

      setErrore(
        "Il codice è mostrato una sola volta. Crea o recupera nuovamente il profilo."
      )
      setLoading(false)
    }

    void caricaCodice()
  }, [params.code])

  async function copiaCodice() {
    try {
      await navigator.clipboard.writeText(codice)
      setCopiato(true)

      window.setTimeout(() => {
        setCopiato(false)
      }, 2000)
    } catch {
      setErrore("Non siamo riusciti a copiare il codice.")
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <Logo size="medium" />
          <div className="mx-auto mt-8 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center text-center">
        <Logo size="medium" />

        {errore ? (
          <div className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="text-red-300">{errore}</p>
          </div>
        ) : (
          <div className="mt-8 rounded-[2rem] border border-pink-400/30 bg-white/[0.05] p-7 shadow-[0_0_70px_rgba(236,72,153,0.15)] backdrop-blur-xl">
            <span className="text-5xl">🔐</span>

            <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-pink-400">
              Salva questo codice
            </p>

            <h1 className="mt-3 text-3xl font-black">
              Il tuo accesso a Zocyal
            </h1>

            <p className="mt-3 leading-7 text-gray-400">
              Ti servirà per recuperare profilo, match e chat se cambi telefono
              o perdi i dati del browser.
            </p>

            <div className="mt-7 rounded-3xl border border-white/10 bg-black/50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">
                Codice personale
              </p>

              <p className="mt-3 break-all font-mono text-2xl font-black tracking-[0.12em] text-white sm:text-3xl">
                {codice}
              </p>
            </div>

            <button
              type="button"
              onClick={copiaCodice}
              className="mt-5 w-full rounded-full border border-pink-500/40 bg-pink-500/10 px-6 py-4 font-black text-white transition hover:bg-pink-500/20"
            >
              {copiato ? "✅ CODICE COPIATO" : "📋 COPIA IL CODICE"}
            </button>

            <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
              <p className="text-sm font-bold text-orange-200">
                Fai anche uno screenshot di questa schermata.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(`/evento/${params.code}/questionario`)
              }
              className="mt-6 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 text-lg font-black text-white shadow-[0_0_35px_rgba(236,72,153,0.22)] transition hover:scale-[1.02]"
            >
              HO SALVATO IL CODICE
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
