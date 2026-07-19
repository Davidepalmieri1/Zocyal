"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import EventQR from "@/app/admin/components/EventQR"
import Logo from "@/app/components/Logo"
import { fetchAdminData } from "@/app/admin/data-client"

type Dashboard = {
  event: { name: string | null; venue: string | null; code: string }
  totals: { participants: number; matches: number; messages: number; reports: number; drinkOffers:number; drinkAccepted:number; drinkRedeemed:number }
  drinkCoupons: {id:string;coupon_code:string;sender:string;receiver:string;discount_cents:number}[]
}

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
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

  async function usaCoupon(id:string){const response=await fetch("/admin/api/drinks",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,event_code:code})});if(response.ok)await load(true);else setError((await response.json()).error||"Coupon non valido.")}

  return <div className="flex min-h-screen bg-black text-white"><Sidebar /><main className="relative min-w-0 flex-1 px-5 pb-6 pt-20 lg:p-8">
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 md:p-8"><Logo size="medium" /><p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-pink-400">Centro di controllo evento</p><h1 className="mt-3 text-4xl font-black md:text-5xl">{data.event.name || "Evento"}</h1><p className="mt-3 text-gray-400">📍 {data.event.venue || "Luogo non indicato"}</p><p className="mt-3 font-black text-pink-300">Codice: {code}</p></section>
    <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.title} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><div className="text-3xl">{card.icon}</div><p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-500">{card.title}</p><p className="mt-2 text-5xl font-black">{card.value}</p></article>)}</section>
    <section className="mt-6 max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><h2 className="text-2xl font-black">QR dell&apos;evento</h2><div className="mt-5"><EventQR code={code} name={data.event.name || "Evento Zocyal"} venue={data.event.venue || ""} /></div></section>
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><h2 className="text-2xl font-black">Coupon drink da utilizzare</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{data.drinkCoupons.length?data.drinkCoupons.map(coupon=><article key={coupon.id} className="rounded-2xl border border-green-400/20 bg-green-400/10 p-5"><p className="text-2xl font-black tracking-widest text-green-300">{coupon.coupon_code}</p><p className="mt-2 text-sm text-zinc-300">{coupon.sender} offre a {coupon.receiver} · sconto 2 €</p><button onClick={()=>void usaCoupon(coupon.id)} className="mt-4 w-full rounded-xl bg-green-400 px-4 py-3 font-black text-black">SEGNA UTILIZZATO</button></article>):<p className="text-zinc-400">Nessun coupon attivo.</p>}</div></section>
  </main></div>
}
