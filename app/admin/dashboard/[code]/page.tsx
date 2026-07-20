"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import EventQR from "@/app/admin/components/EventQR"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { fetchAdminData } from "@/app/admin/data-client"

type Dashboard = {
  event: { name: string | null; venue: string | null; code: string }
  totals: { participants: number; matches: number; messages: number; reports: number; drinkOffers: number; drinkAccepted: number; drinkRedeemed: number }
  drinkCoupons: { id: string; coupon_code: string; sender: string; receiver: string; discount_cents: number; status: string }[]
}

type SearchResult = { kind: "participant" | "coupon" | "reward" | "mission"; title: string; subtitle: string; href?: string; offerId?: string; status?: string }
type Filter = "all" | SearchResult["kind"]

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Tutto" }, { id: "participant", label: "Partecipanti" }, { id: "coupon", label: "Coupon" }, { id: "reward", label: "Premi" }, { id: "mission", label: "Missioni" },
]

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { setData(await fetchAdminData<Dashboard>("dashboard", code)); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Errore inatteso.") }
    finally { if (!silent) setLoading(false) }
  }, [code])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true) }, 10000)
    return () => window.clearInterval(timer)
  }, [load])

  async function redeemCoupon(id: string) {
    if (!window.confirm("Confermi che lo sconto è stato applicato? Il coupon diventerà utilizzato.")) return
    const response = await fetch("/admin/api/drinks", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, event_code: code }) })
    if (response.ok) await load(true)
    else setError((await response.json()).error || "Coupon non valido.")
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get("q") || "").trim()
    if (query.length < 2) return
    setSearching(true); setSearchDone(false)
    try {
      const response = await fetch(`/admin/api/search?code=${encodeURIComponent(code)}&q=${encodeURIComponent(query)}`, { credentials: "same-origin", cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setSearchResults(body.results || []); setSearchDone(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ricerca non disponibile.") }
    finally { setSearching(false) }
  }

  if (loading) return <main className="premium-page flex min-h-screen items-center justify-center text-white"><PremiumBackdrop /><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-pink-400" /><p className="premium-eyebrow mt-5">Sincronizzazione</p><p className="mt-2 font-bold">Prepariamo il centro di controllo…</p></div></main>
  if (error && !data) return <main className="premium-page flex min-h-screen items-center justify-center p-6 text-white"><PremiumBackdrop /><section className="premium-glass max-w-md rounded-[2rem] p-8 text-center"><h1 className="text-3xl font-black">Dashboard non disponibile</h1><p role="alert" className="mt-4 text-red-200">{error}</p><button onClick={() => void load()} className="mt-6 rounded-full bg-white px-6 py-3 font-black text-black">RIPROVA</button></section></main>
  if (!data) return null

  const shownResults = filter === "all" ? searchResults : searchResults.filter((result) => result.kind === filter)
  const validCoupons = data.drinkCoupons.filter((coupon) => coupon.status === "accepted")
  const cards = [
    { title: "Presenti", value: data.totals.participants, symbol: "◎", href: `/admin/partecipanti/${code}`, tone: "pink" },
    { title: "Match", value: data.totals.matches, symbol: "♥", href: `/admin/match/${code}`, tone: "pink" },
    { title: "Messaggi", value: data.totals.messages, symbol: "◌", href: `/admin/chat/${code}`, tone: "violet" },
    { title: "Segnalazioni", value: data.totals.reports, symbol: "!", href: `/admin/chat/${code}`, tone: data.totals.reports ? "danger" : "neutral" },
  ]

  return (
    <div className="flex min-h-screen bg-[#050306] text-white">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-hidden px-4 pb-10 pt-20 sm:px-6 lg:p-8">
        <PremiumBackdrop orbs={false} />
        <div className="relative mx-auto max-w-[1500px]">
          <header className="premium-enter flex flex-col justify-between gap-6 border-b border-white/[.07] pb-7 sm:flex-row sm:items-end">
            <div><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,.7)]" /><p className="premium-eyebrow !text-emerald-300">Evento in tempo reale</p></div><h1 className="premium-title mt-4 text-4xl font-black sm:text-6xl">{data.event.name || "Evento"}</h1><p className="mt-3 text-sm text-white/45">⌖ {data.event.venue || "Luogo non indicato"} · Codice <strong className="text-pink-300">{code}</strong></p></div>
            <div className="flex gap-2"><button onClick={() => void load(true)} className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black text-white/60 hover:bg-white/[.08] hover:text-white">↻ AGGIORNA</button><a href={`/admin/impostazioni/${code}`} className="rounded-xl bg-white px-4 py-3 text-xs font-black text-black">IMPOSTAZIONI</a></div>
          </header>

          {error && <p role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

          <section aria-label="Indicatori principali" className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((card, index) => <a href={card.href} key={card.title} className={`premium-card-lift premium-enter rounded-[1.75rem] border p-5 sm:p-6 ${card.tone === "danger" ? "border-red-400/25 bg-red-400/[.08]" : "border-white/[.08] bg-white/[.035]"}`} style={{ animationDelay: `${index * 60}ms` }}><div className="flex items-start justify-between"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/38">{card.title}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone === "danger" ? "bg-red-400/15 text-red-300" : "bg-pink-400/10 text-pink-300"}`}>{card.symbol}</span></div><p className="mt-7 text-4xl font-black tracking-tight sm:text-5xl">{card.value}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/25">Apri dettaglio →</p></a>)}
          </section>

          <section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7">
            <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr] lg:items-end"><div><p className="premium-eyebrow">Ricerca istantanea</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Trova qualunque cosa.</h2><p className="mt-2 text-sm leading-6 text-white/38">Persone, coupon, premi e missioni senza perdere tempo al bancone.</p></div><form onSubmit={search} className="flex gap-2"><input name="q" minLength={2} required aria-label="Cerca nella dashboard" placeholder="Nome, codice coupon, premio…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.065] px-5 py-4 text-white outline-none placeholder:text-white/25 focus:border-pink-400/50 focus:ring-4 focus:ring-pink-500/10" /><button disabled={searching} className="premium-cta rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-5 text-xs font-black disabled:opacity-50 sm:px-7">{searching ? "CERCO…" : "CERCA"}</button></form></div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{filters.map((item) => <button type="button" key={item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-wider ${filter === item.id ? "border-pink-300 bg-pink-300 text-black" : "border-white/10 text-white/45 hover:text-white"}`}>{item.label}</button>)}</div>
            {searchDone && <div className="mt-5 grid gap-3 md:grid-cols-2">{shownResults.length ? shownResults.map((result, index) => <article key={`${result.kind}-${result.title}-${index}`} className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-pink-300">{result.kind}</p><h3 className="mt-1 font-black">{result.title}</h3><p className="mt-1 text-sm text-white/38">{result.subtitle}</p></div>{result.kind === "coupon" && result.status === "accepted" && result.offerId ? <button onClick={() => void redeemCoupon(result.offerId!)} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-black">USA</button> : result.href ? <a href={result.href} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black">APRI</a> : null}</div></article>) : <p className="text-sm text-white/40">Nessun risultato trovato.</p>}</div>}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_.5fr]">
            <section className="rounded-[2rem] border border-white/[.08] bg-white/[.03] p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="premium-eyebrow">Banco e riscatti</p><h2 className="mt-2 text-2xl font-black">Coupon drink</h2></div><span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">{validCoupons.length} DA USARE</span></div><div className="mt-5 grid gap-3 md:grid-cols-2">{data.drinkCoupons.length ? data.drinkCoupons.map((coupon) => <article key={coupon.id} className={`rounded-2xl border p-5 ${coupon.status === "redeemed" ? "border-white/[.07] bg-white/[.025] opacity-55" : "border-emerald-400/20 bg-emerald-400/[.07]"}`}><div className="flex items-start justify-between gap-3"><p className={`text-xl font-black tracking-[.15em] ${coupon.status === "redeemed" ? "text-white/35 line-through" : "text-emerald-300"}`}>{coupon.coupon_code}</p><span className="text-[9px] font-black uppercase tracking-wider text-white/40">{coupon.status === "redeemed" ? "Utilizzato" : "Valido"}</span></div><p className="mt-3 text-sm text-white/45">{coupon.sender} offre a {coupon.receiver} · sconto {(coupon.discount_cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>{coupon.status === "accepted" && <button onClick={() => void redeemCoupon(coupon.id)} className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-black">SEGNA UTILIZZATO</button>}</article>) : <p className="text-sm text-white/35">Nessun coupon da gestire.</p>}</div></section>
            <section className="rounded-[2rem] border border-white/[.08] bg-white/[.03] p-5 sm:p-7"><p className="premium-eyebrow">Ingresso</p><h2 className="mt-2 text-2xl font-black">QR evento</h2><p className="mt-2 text-sm text-white/38">Mostralo all’ingresso per un accesso immediato.</p><div className="mt-5"><EventQR code={code} name={data.event.name || "Evento Zocyal"} venue={data.event.venue || ""} /></div></section>
          </div>
        </div>
      </main>
    </div>
  )
}
