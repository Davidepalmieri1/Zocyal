import Link from "next/link"
import Logo from "@/app/components/Logo"
import ExistingProfileActions from "@/app/components/ExistingProfileActions"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type EventoPageProps = {
  params: Promise<{
    code: string
  }>
}

export default async function EventoPage({
  params,
}: EventoPageProps) {
  const { code } = await params
  const eventCode = code.trim().toLowerCase()

  const { data: event, error } = await supabase
    .from("events")
    .select("name, venue, code, status, starts_at, ends_at")
    .eq("code", eventCode)
    .maybeSingle()

  if (error) {
    console.error("Errore caricamento evento:", error)
  }

  const now = Date.now()
  const unavailable = event && (
    event.status !== "open" ||
    (event.starts_at && new Date(event.starts_at).getTime() > now) ||
    (event.ends_at && new Date(event.ends_at).getTime() <= now)
  )

  if (!event || unavailable) {
    return (
      <main className="premium-page px-6 text-white">
        <PremiumBackdrop />

        <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
          <Logo size="large" />

          <p className="premium-eyebrow mt-8">Stato evento</p>
          <h1 className="premium-title mt-4 text-4xl font-black">
            {event ? "Evento non disponibile" : "Evento non trovato"}
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            {event?.status === "draft" ? "L'evento non è ancora aperto ai partecipanti." : event ? "L'evento è terminato oppure si trova fuori dall'orario previsto." : "Il codice inserito non esiste oppure l'evento non è più disponibile."}
          </p>

          <Link
            href="/evento"
            className="premium-cta mt-8 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 font-black text-white"
          >
            INSERISCI UN ALTRO CODICE
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="premium-page px-6 text-white">
      <PremiumBackdrop />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
        <Logo size="large" />

        <div className="premium-glass premium-enter mt-8 w-full rounded-[2.25rem] p-8">
          <p className="premium-eyebrow">
            Evento attivo
          </p>

          <h1 className="premium-title mt-4 text-5xl font-black">
            {event.name}
          </h1>

          {event.venue && (
            <p className="mt-3 text-gray-400">
              📍 {event.venue}
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner">
            <p className="text-sm text-gray-500">
              Codice evento
            </p>

            <p className="mt-1 text-xl font-black text-pink-400">
              {event.code}
            </p>
          </div>

          <ExistingProfileActions eventCode={event.code} />
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Entra, scegli cosa fare e vivi la serata.
        </p>
      </div>
    </main>
  )
}
