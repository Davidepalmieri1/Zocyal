"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import EventQR from "@/app/admin/components/EventQR"
import Logo from "@/app/components/Logo"
import { fetchAdminData } from "@/app/admin/data-client"

type Dashboard = {
  event: { name: string | null; venue: string | null; code: string }
  totals: { participants: number; matches: number; messages: number; reports: number; drinkOffers:number; drinkAccepted:number; drinkRedeemed:number }
  drinkCoupons: {id:string;coupon_code:string;sender:string;receiver:string;discount_cents:number;status:string}[]
}
type SearchResult={kind:"participant"|"coupon"|"reward"|"mission";title:string;subtitle:string;href?:string;offerId?:string;status?:string}

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchResults,setSearchResults]=useState<SearchResult[]>([])
  const [searching,setSearching]=useState(false)
  const [searchDone,setSearchDone]=useState(false)
  const [filter,setFilter]=useState<"all"|SearchResult["kind"]>("all")
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { setData(await fetchAdminData<Dashboard>("dashboard", code)); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Errore inatteso.") }
    finally { if (!silent) setLoading(false) }
  }, [code])
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(true), 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [load])

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-black text-white">Carico la dashboard...</main>
  if (error || !data) return <main className="flex min-h-screen items-center justify-center bg-black p-6 text-red-200"><p role="alert">{error || "Dashboard non disponibile."}</p></main>
  const cards = [{ title: "Partecipanti", value: data.totals.participants, icon: "👥" }, { title: "Match creati", value: data.totals.matches, icon: "❤️" }, { title: "Drink offerti", value: data.totals.drinkOffers, icon: "🍹" }, { title: "Drink accettati", value: data.totals.drinkAccepted, icon: "🥂" }, { title: "Coupon usati", value: data.totals.drinkRedeemed, icon: "✅" }, { title: "Messaggi", value: data.totals.messages, icon: "💬" }, { title: "Segnalazioni", value: data.totals.reports, icon: "🛡️" }]

  async function usaCoupon(id:string){if(!window.confirm("Confermi che lo sconto è stato applicato? Il coupon diventerà utilizzato."))return;const response=await fetch("/admin/api/drinks",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,event_code:code})});if(response.ok)await load(true);else setError((await response.json()).error||"Coupon non valido.")}
  async function search(event:FormEvent<HTMLFormElement>){event.preventDefault();const q=String(new FormData(event.currentTarget).get("q")||"").trim();if(q.length<2)return;setSearching(true);setSearchDone(false);try{const response=await fetch(`/admin/api/search?code=${encodeURIComponent(code)}&q=${encodeURIComponent(q)}`,{credentials:"same-origin",cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);setSearchResults(body.results||[]);setSearchDone(true)}catch(cause){setError(cause instanceof Error?cause.message:"Ricerca non disponibile.")}finally{setSearching(false)}}
  const shownResults=filter==="all"?searchResults:searchResults.filter(result=>result.kind===filter)

  return <div className="flex min-h-screen bg-black text-white"><Sidebar /><main className="relative min-w-0 flex-1 px-5 pb-6 pt-20 lg:p-8">
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 md:p-8"><div className="flex flex-col items-start justify-between gap-5 sm:flex-row"><div><Logo size="medium" /><p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-pink-400">Centro di controllo evento</p><h1 className="mt-3 text-4xl font-black md:text-5xl">{data.event.name || "Evento"}</h1><p className="mt-3 text-gray-400">📍 {data.event.venue || "Luogo non indicato"}</p><p className="mt-3 font-black text-pink-300">Codice: {code}</p></div><a href="/admin/events/new" className="rounded-2xl border border-pink-400/30 bg-pink-500/10 px-5 py-4 text-sm font-black text-pink-200">＋ CREA NUOVO EVENTO</a></div></section>
    <section className="mt-6 rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 to-orange-400/5 p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-pink-300">Ricerca rapida staff</p><h2 className="mt-2 text-2xl font-black">Trova subito persone, coupon e attività</h2><form onSubmit={search} className="mt-5 flex flex-col gap-2 sm:flex-row"><input name="q" minLength={2} required placeholder="Nome partecipante, codice coupon, premio..." className="min-w-0 flex-1 rounded-xl bg-white px-4 py-4 font-semibold text-black"/><button disabled={searching} className="rounded-xl bg-pink-500 px-6 py-4 font-black text-white disabled:opacity-60">{searching?"CERCO...":"CERCA"}</button></form><div className="mt-3 flex flex-wrap gap-2">{[["all","TUTTO"],["participant","PARTECIPANTI"],["coupon","COUPON"],["reward","PREMI"],["mission","MISSIONI"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id as typeof filter)} className={`rounded-full border px-3 py-2 text-xs font-black ${filter===id?"border-pink-300 bg-pink-300 text-black":"border-white/10 text-zinc-300"}`}>{label}</button>)}</div>{searchDone&&<div className="mt-5 grid gap-3 md:grid-cols-2">{shownResults.length?shownResults.map((result,index)=><article key={`${result.kind}-${result.title}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-pink-300">{result.kind}</p><h3 className="mt-1 text-lg font-black">{result.title}</h3><p className="mt-1 text-sm text-zinc-400">{result.subtitle}</p></div>{result.kind==="coupon"&&result.status==="accepted"&&result.offerId?<button onClick={()=>void usaCoupon(result.offerId!)} className="shrink-0 rounded-xl bg-green-400 px-3 py-2 text-xs font-black text-black">USA</button>:result.href?<a href={result.href} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-black">APRI</a>:null}</div></article>):<p className="text-zinc-400">Nessun risultato trovato.</p>}</div>}</section>
    <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.title} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><div className="text-3xl">{card.icon}</div><p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-500">{card.title}</p><p className="mt-2 text-5xl font-black">{card.value}</p></article>)}</section>
    <section className="mt-6 max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><h2 className="text-2xl font-black">QR dell&apos;evento</h2><div className="mt-5"><EventQR code={code} name={data.event.name || "Evento Zocyal"} venue={data.event.venue || ""} /></div></section>
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><h2 className="text-2xl font-black">Coupon drink</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{data.drinkCoupons.length?data.drinkCoupons.map(coupon=><article key={coupon.id} className={`rounded-2xl border p-5 ${coupon.status==="redeemed"?"border-white/10 bg-white/[.03] opacity-70":"border-green-400/20 bg-green-400/10"}`}><div className="flex items-start justify-between gap-3"><p className={`text-2xl font-black tracking-widest ${coupon.status==="redeemed"?"text-zinc-400 line-through":"text-green-300"}`}>{coupon.coupon_code}</p><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black">{coupon.status==="redeemed"?"UTILIZZATO":"VALIDO"}</span></div><p className="mt-2 text-sm text-zinc-300">{coupon.sender} offre a {coupon.receiver} · sconto 2 €</p>{coupon.status==="accepted"&&<button onClick={()=>void usaCoupon(coupon.id)} className="mt-4 w-full rounded-xl bg-green-400 px-4 py-3 font-black text-black">SEGNA UTILIZZATO</button>}</article>):<p className="text-zinc-400">Nessun coupon.</p>}</div></section>
  </main></div>
}
