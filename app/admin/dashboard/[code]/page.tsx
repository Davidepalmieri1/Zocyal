"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import EventQR from "@/app/admin/components/EventQR"
import Logo from "@/app/components/Logo"
import { fetchAdminData } from "@/app/admin/data-client"

type Dashboard = {
  event: { name: string | null; venue: string | null; code: string }
  totals: { participants: number; matches: number; messages: number; reports: number }
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
  const cards = [{ title: "Partecipanti", value: data.totals.participants, icon: "👥" }, { title: "Match creati", value: data.totals.matches, icon: "❤️" }, { title: "Messaggi", value: data.totals.messages, icon: "💬" }, { title: "Segnalazioni", value: data.totals.reports, icon: "🛡️" }]

  return <div className="flex min-h-screen bg-black text-white"><Sidebar /><main className="relative min-w-0 flex-1 px-5 pb-6 pt-20 lg:p-8">
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 md:p-8"><Logo size="medium" /><p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-pink-400">Centro di controllo evento</p><h1 className="mt-3 text-4xl font-black md:text-5xl">{data.event.name || "Evento"}</h1><p className="mt-3 text-gray-400">📍 {data.event.venue || "Luogo non indicato"}</p><p className="mt-3 font-black text-pink-300">Codice: {code}</p></section>
    <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.title} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><div className="text-3xl">{card.icon}</div><p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-500">{card.title}</p><p className="mt-2 text-5xl font-black">{card.value}</p></article>)}</section>
    <section className="mt-6 max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-6"><h2 className="text-2xl font-black">QR dell&apos;evento</h2><div className="mt-5"><EventQR code={code} name={data.event.name || "Evento Zocyal"} venue={data.event.venue || ""} /></div></section>
  </main></div>
}
