import Link from "next/link"
import Logo from "@/app/components/Logo"
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
    .select("name, venue, code")
    .eq("code", eventCode)
    .maybeSingle()

  if (error) {
    console.error("Errore caricamento evento:", error)
  }

  if (!event) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

        <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
          <Logo size="large" />

          <h1 className="mt-8 text-3xl font-black">
            Evento non trovato
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Il codice inserito non esiste oppure l&apos;evento non è più
            disponibile.
          </p>

          <Link
            href="/evento"
            className="mt-8 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02]"
          >
            INSERISCI UN ALTRO CODICE
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
        <Logo size="large" />

        <div className="mt-8 w-full rounded-3xl border border-white/10 bg-white/[0.05] p-8 backdrop-blur">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            Evento attivo
          </p>

          <h1 className="mt-4 text-4xl font-black">
            {event.name}
          </h1>

          {event.venue && (
            <p className="mt-3 text-gray-400">
              📍 {event.venue}
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-gray-500">
              Codice evento
            </p>

            <p className="mt-1 text-xl font-black text-pink-400">
              {event.code}
            </p>
          </div>

          <Link
            href={`/evento/${event.code}/profilo`}
            className="mt-8 block w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-lg font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02]"
          >
            CREA IL TUO PROFILO
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Entra, scegli cosa fare e vivi la serata.
        </p>
      </div>
    </main>
  )
}