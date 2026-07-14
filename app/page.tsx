import Link from "next/link"
import Logo from "@/app/components/Logo"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

      <div className="pointer-events-none absolute bottom-[-200px] right-[-160px] h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center py-10 text-center">
        <Logo size="large" />

        <h1 className="sr-only">
          Zocyal
        </h1>

        <p className="mt-2 max-w-sm text-xl font-medium leading-8 text-gray-200">
          La serata dove ogni incontro può diventare qualcosa.
        </p>

        <Link
          href="/evento"
          className="mt-10 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-lg font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.28)] transition hover:scale-[1.02] active:scale-[0.98]"
        >
          ENTRA NELLA SERATA
        </Link>

        <Link
          href="/admin"
          className="group mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-gray-400 transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-pink-300 active:scale-[0.98]"
        >
          <span className="text-base transition group-hover:rotate-12">
            ⚙️
          </span>

          Accesso amministratore
        </Link>

        <div className="mt-12 grid w-full gap-4 text-left">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <p className="font-bold">
              🤝 Conosci nuove persone
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Trova persone con la tua stessa energia.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <p className="font-bold">
              ❤️ Scopri le affinità
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Lascia che Zocyal trovi le connessioni migliori.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <p className="font-bold">
              🎯 Missioni e premi
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Vivi la serata, completa sfide e conquista premi.
            </p>
          </div>
        </div>

        <p className="mt-8 text-[11px] text-gray-700">
          Area amministratore riservata alla gestione degli eventi
        </p>
      </div>
    </main>
  )
}