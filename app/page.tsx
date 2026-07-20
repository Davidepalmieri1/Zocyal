import Link from "next/link"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

const experiences = [
  { number: "01", title: "Match reali", text: "Affinità che diventano conversazioni, non swipe infiniti.", accent: "from-fuchsia-500/20 to-pink-500/5" },
  { number: "02", title: "Momenti condivisi", text: "Missioni sociali pensate per rompere il ghiaccio con naturalezza.", accent: "from-pink-500/20 to-orange-400/5" },
  { number: "03", title: "Premi che accendono la serata", text: "Punti, drink e sorprese che trasformano il locale in un’esperienza.", accent: "from-orange-400/20 to-amber-300/5" },
]

export default function Home() {
  return (
    <main className="premium-page px-5 sm:px-8">
      <PremiumBackdrop />

      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between py-5 sm:py-7">
        <Logo size="small" className="premium-enter !items-start" />
        <Link href="/admin/login" className="premium-enter rounded-full border border-white/10 bg-white/[0.045] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.18em] text-white/60 backdrop-blur-xl transition hover:border-pink-400/30 hover:bg-pink-400/10 hover:text-white sm:px-5 sm:text-xs">
          Area organizzatori
        </Link>
      </nav>

      <section className="relative mx-auto grid min-h-[calc(100svh-100px)] w-full max-w-7xl items-center gap-12 pb-16 pt-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-20 lg:pb-24">
        <div className="relative z-10 max-w-3xl">
          <div className="premium-enter inline-flex items-center gap-2 rounded-full border border-pink-300/15 bg-pink-400/[0.07] px-4 py-2 backdrop-blur-xl">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-60" /><span className="relative h-2 w-2 rounded-full bg-pink-300" /></span>
            <span className="premium-eyebrow !text-[9px] sm:!text-[10px]">The social layer of your night</span>
          </div>

          <h1 className="premium-title premium-enter premium-enter-delay-1 mt-7 text-[clamp(3.4rem,10vw,7.8rem)] font-black">
            Non uscire.<br /><span className="premium-gradient-text">Succedi.</span>
          </h1>

          <p className="premium-enter premium-enter-delay-2 mt-7 max-w-xl text-lg leading-8 text-white/58 sm:text-xl sm:leading-9">
            Zocyal trasforma ogni evento in un’esperienza viva: persone giuste, incontri spontanei e piccoli motivi per ricordare la serata.
          </p>

          <div className="premium-enter premium-enter-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/evento" className="premium-cta flex min-h-16 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 text-sm font-black uppercase tracking-[.12em] text-white">
              Entra nella serata <span aria-hidden="true" className="text-xl">↗</span>
            </Link>
            <a href="#experience" className="flex min-h-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] px-8 text-sm font-bold text-white/70 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.075] hover:text-white">
              Scopri come funziona
            </a>
          </div>

          <div className="premium-enter premium-enter-delay-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-bold text-white/38">
            <span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Nessuna app da scaricare</span>
            <span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-pink-400" /> Profilo in meno di un minuto</span>
          </div>
        </div>

        <div className="premium-enter premium-enter-delay-2 relative mx-auto hidden w-full max-w-lg lg:block">
          <div className="premium-glass relative rotate-[3deg] rounded-[3rem] p-3 shadow-[0_45px_120px_rgba(0,0,0,.5)]">
            <div className="relative min-h-[570px] overflow-hidden rounded-[2.45rem] border border-white/8 bg-[#0b080d] p-7">
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/70 to-transparent" />
              <div className="flex items-center justify-between"><span className="premium-eyebrow">Live experience</span><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">● Live</span></div>
              <div className="mt-12 text-center"><span className="text-6xl">✦</span><p className="mt-4 text-xs font-black uppercase tracking-[.24em] text-pink-300">Nuova affinità</p><h2 className="mt-3 text-4xl font-black tracking-tight">92% di energia<br />in comune</h2></div>
              <div className="mt-10 grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-white/8 bg-white/[.045] p-5"><p className="text-2xl">◉</p><p className="mt-8 text-xs text-white/40">Missione live</p><p className="mt-1 font-bold">Offri un drink</p></div>
                <div className="rounded-3xl border border-pink-300/15 bg-gradient-to-br from-pink-500/15 to-orange-400/5 p-5"><p className="text-2xl">♥</p><p className="mt-8 text-xs text-white/40">Connessioni</p><p className="mt-1 font-bold">3 nuovi match</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-3xl border border-white/8 bg-white/[.035] p-5"><div><p className="text-xs text-white/40">La tua serata</p><p className="mt-1 text-lg font-black">Sta prendendo vita</p></div><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-black">→</span></div>
            </div>
          </div>
          <div className="premium-glass absolute -left-16 top-24 -rotate-6 rounded-2xl px-5 py-4"><p className="text-[10px] font-black uppercase tracking-widest text-white/40">Match</p><p className="mt-1 text-lg font-black text-pink-200">It’s a vibe ✦</p></div>
        </div>
      </section>

      <section id="experience" className="relative mx-auto w-full max-w-7xl border-t border-white/8 py-16 sm:py-24">
        <div className="max-w-2xl"><p className="premium-eyebrow">Un’esperienza, non una funzione</p><h2 className="premium-title mt-4 text-4xl font-black sm:text-6xl">La notte ha finalmente una sua interfaccia.</h2></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {experiences.map((item) => <article key={item.number} className={`premium-card-lift premium-glass rounded-[2rem] bg-gradient-to-br ${item.accent} p-7 sm:p-8`}><span className="text-xs font-black tracking-[.2em] text-white/28">{item.number}</span><h3 className="mt-14 text-2xl font-black tracking-tight">{item.title}</h3><p className="mt-3 leading-7 text-white/48">{item.text}</p></article>)}
        </div>
      </section>

      <footer className="relative mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-white/8 py-8 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between"><span>© Zocyal — Vivi la serata, davvero.</span><Link href="/admin/login" className="transition hover:text-white">Accesso organizzatori</Link></footer>
    </main>
  )
}
