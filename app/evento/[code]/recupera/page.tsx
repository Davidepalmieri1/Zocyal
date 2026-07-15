"use client"

import { FormEvent, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"

export default function RecuperaProfiloPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [codice, setCodice] = useState("")
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState("")

  async function recuperaProfilo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const recoveryCode = codice.trim().toUpperCase()
    const eventCode = params.code.trim().toLowerCase()

    if (recoveryCode.length !== 8) {
      setErrore("Inserisci il codice personale di 8 caratteri.")
      return
    }

    setLoading(true)
    setErrore("")

    const { data: participant, error } = await supabase
      .from("participants")
      .select("id, completed_test")
      .eq("event_code", eventCode)
      .eq("recovery_code", recoveryCode)
      .maybeSingle()

    if (error) {
      console.error("Errore recupero profilo:", error)
      setErrore("Non siamo riusciti a recuperare il profilo.")
      setLoading(false)
      return
    }

    if (!participant) {
      setErrore("Codice non riconosciuto per questo evento.")
      setLoading(false)
      return
    }

    localStorage.setItem("participant_id", participant.id)
    localStorage.setItem("event_code", eventCode)

    router.push(
      participant.completed_test
        ? `/evento/${eventCode}/scegli`
        : `/evento/${eventCode}/questionario`
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <Logo size="medium" />

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            Bentornato
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Recupera il tuo profilo
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Inserisci il codice personale mostrato nella pagina del tuo profilo.
          </p>

          <form onSubmit={recuperaProfilo} className="mt-7">
            <input
              type="text"
              value={codice}
              onChange={(event) => {
                setCodice(event.target.value.toUpperCase())
                setErrore("")
              }}
              placeholder="ESEMPIO: A1B2C3D4"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-center text-xl font-black uppercase tracking-[0.18em] text-black outline-none transition placeholder:text-sm placeholder:tracking-normal placeholder:text-gray-400 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20"
            />

            {errore && (
              <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {errore}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white shadow-[0_0_35px_rgba(236,72,153,0.22)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "RECUPERO..." : "RIENTRA NEL PROFILO"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push(`/evento/${params.code}/profilo`)}
            className="mt-4 text-sm font-bold text-gray-400 transition hover:text-pink-300"
          >
            Non hai ancora un profilo? Crealo
          </button>
        </div>
      </div>
    </main>
  )
}
