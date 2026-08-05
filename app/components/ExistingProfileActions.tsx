"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"

type ExistingProfileActionsProps = {
  eventCode: string
}

export default function ExistingProfileActions({
  eventCode,
}: ExistingProfileActionsProps) {
  const [loading, setLoading] = useState(true)
  const [profiloTrovato, setProfiloTrovato] = useState(false)

  useEffect(() => {
    let active = true
    const normalizedEventCode = eventCode.trim().toLowerCase()

    async function verificaProfilo() {
      const participantId = localStorage.getItem("participant_id")
      const savedEventCode = localStorage.getItem("event_code")
      const profiloMemorizzato = Boolean(
        participantId && savedEventCode === normalizedEventCode
      )

      // Mostra subito il profilo noto mentre Supabase ripristina e verifica
      // la sessione anonima associata al partecipante.
      if (active && profiloMemorizzato) {
        setProfiloTrovato(true)
        setLoading(false)
      }

      try {
        const participantIdRisolto =
          await resolveCurrentParticipant(normalizedEventCode)

        if (active) {
          setProfiloTrovato(Boolean(participantIdRisolto))
          setLoading(false)
        }
      } catch {
        // Un errore temporaneo di rete non deve cancellare un profilo valido
        // dalla memoria del dispositivo né obbligare l'utente a ricaricare.
        if (active) {
          setProfiloTrovato(profiloMemorizzato)
          setLoading(false)
        }
      }
    }

    void verificaProfilo()

    return () => {
      active = false
    }
  }, [eventCode])

  if (loading) {
    return (
      <div className="mt-8 flex justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />
      </div>
    )
  }

  if (profiloTrovato) {
    return (
      <div className="mt-8">
        <div className="rounded-2xl border border-green-400/25 bg-green-400/10 p-4">
          <p className="font-black text-green-300">
            ✅ Profilo già riconosciuto
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-300">
            Non serve crearne un altro. Puoi continuare la serata.
          </p>
        </div>

        <Link
          href={`/evento/${eventCode}/scegli`}
          className="mt-4 block w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-lg font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02]"
        >
          CONTINUA LA SERATA
        </Link>

        <Link
          href={`/evento/${eventCode}/mio-profilo`}
          className="mt-4 block w-full rounded-full border border-white/10 bg-white/[0.04] px-8 py-4 font-black text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
        >
          👤 VEDI IL MIO PROFILO
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <Link
        href={`/evento/${eventCode}/profilo`}
        className="block w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-lg font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02]"
      >
        CREA IL TUO PROFILO
      </Link>

      <Link
        href={`/evento/${eventCode}/recupera`}
        className="mt-4 block w-full rounded-full border border-pink-500/40 bg-pink-500/10 px-8 py-4 font-black text-white transition hover:bg-pink-500/20"
      >
        HO GIÀ UN PROFILO
      </Link>
    </div>
  )
}
