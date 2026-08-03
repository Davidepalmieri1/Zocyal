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
    .select("name, venue, code, status, starts_at, ends_at, venue_logo_url, venue_poster_url")
    .eq("code", eventCode)
    .maybeSingle()

  if (error) {
    console.error("Errore caricamento evento:", error)
  }

  if (!event) {
    return (
      <main className="premium-page px-6 text-white">
        <PremiumBackdrop />

        <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
          <Logo size="large" />

          <p className="premium-eyebrow mt-8">Stato evento</p>
          <h1 className="premium-title mt-4 text-4xl font-black">
            Evento non disponibile
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Il codice inserito non esiste oppure l&apos;evento non è
            disponibile in questo momento.
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

        <div className="premium-glass premium-enter relative mt-8 w-full overflow-hidden rounded-[2.25rem] p-8">
          {event.venue_poster_url && <div className="absolute inset-0"><img src={event.venue_poster_url} alt="Locandina della serata" className="h-full w-full object-cover opacity-20" /><div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/75 to-black" /></div>}
          <div className="relative">
          {event.venue_logo_url && <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-white/15 bg-white/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,.45)]"><img src={event.venue_logo_url} alt={`Logo ${event.venue || "locale"}`} className="max-h-full max-w-full object-contain" /></div>}
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
        </div>

        {event.venue_poster_url && <div className="premium-enter mt-5 w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.04] p-2 shadow-[0_25px_90px_rgba(0,0,0,.45)]"><img src={event.venue_poster_url} alt={`Locandina ${event.name}`} className="aspect-[3/4] w-full rounded-[1.55rem] object-cover" /></div>}

        <p className="mt-6 text-sm text-gray-500">
          Entra, scegli cosa fare e vivi la serata.
        </p>
      </div>
    </main>
  )
}
