import Link from "next/link"
import Logo from "@/app/components/Logo"

export default function AdminPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

      <div className="pointer-events-none absolute bottom-[-200px] right-[-160px] h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Logo size="small" />

          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-gray-300 transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-white"
          >
            Torna alla home
          </Link>
        </header>

        <section className="mt-14 text-center">
          <span className="inline-flex rounded-full border border-pink-400/20 bg-pink-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-pink-300">
            Area riservata
          </span>

          <h1 className="mt-5 text-4xl font-black sm:text-5xl">
            Dashboard amministratore
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
            Gestisci eventi, partecipanti, missioni e premi.
          </p>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
            <span className="text-4xl">🎟️</span>

            <h2 className="mt-5 text-xl font-black">
              Eventi
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              Crea e controlla gli eventi attivi.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
            <span className="text-4xl">👥</span>

            <h2 className="mt-5 text-xl font-black">
              Partecipanti
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              Visualizza le persone registrate.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
            <span className="text-4xl">🎯</span>

            <h2 className="mt-5 text-xl font-black">
              Missioni e premi
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              Gestisci sfide, punti e ricompense.
            </p>
          </div>
        </section>

        <div className="mt-10 rounded-[28px] border border-orange-400/20 bg-orange-400/10 p-6 text-center">
          <p className="text-sm leading-7 text-orange-200">
            Dashboard iniziale pronta. L’accesso protetto verrà aggiunto in seguito.
          </p>
        </div>
      </div>
    </main>
  )
}