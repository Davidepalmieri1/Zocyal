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
    .select("name, venue, code, status, starts_at, ends_at, experience_mode, venue_logo_url, venue_poster_url")
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
          {event.venue_poster_url && <div className="absolute inset-0"><img src={event.venue_poster_url} alt="Locandina della serata" className="h-full w-full scale-105 object-cover opacity-35" /><div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/65 to-black/95" /></div>}
          <div className="relative">
          {event.venue_logo_url && (
            <div className="relative mx-auto mb-8 w-full max-w-[17rem] pt-3">
              <div className="absolute inset-x-8 -top-3 h-24 rounded-full bg-fuchsia-500/25 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/30 bg-black/75 p-[1px] shadow-[0_24px_70px_rgba(0,0,0,.7),0_0_45px_rgba(236,72,153,.22)] backdrop-blur-xl">
                <div className="relative flex min-h-36 items-center justify-center overflow-hidden rounded-[1.95rem] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.18),rgba(24,24,27,.92)_52%,rgba(0,0,0,.98))] px-7 py-6">
                  <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                  <img
                    src={event.venue_logo_url}
                    alt={`Logo ${event.venue || "locale"}`}
                    className="relative max-h-24 w-full object-contain drop-shadow-[0_5px_16px_rgba(0,0,0,.95)]"
                  />
                </div>
              </div>
              <p className="relative mt-3 text-[10px] font-black uppercase tracking-[0.3em] text-white/55">
                Location partner
              </p>
            </div>
          )}
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

          <ExistingProfileActions eventCode={event.code} experienceMode={event.experience_mode} />
          </div>
        </div>

        {event.venue_poster_url && <div className="premium-enter mt-6 w-full overflow-hidden rounded-[2rem] border border-pink-400/35 bg-gradient-to-b from-pink-500/15 to-white/[.04] p-3 shadow-[0_25px_100px_rgba(236,72,153,.18)]"><p className="premium-eyebrow mb-3 text-pink-200">Locandina ufficiale</p><img src={event.venue_poster_url} alt={`Locandina ${event.name}`} className="aspect-[3/4] w-full rounded-[1.4rem] object-cover shadow-2xl" /></div>}

        <p className="mt-6 text-sm text-gray-500">
          Entra, scegli cosa fare e vivi la serata.
        </p>
      </div>
    </main>
  )
}
