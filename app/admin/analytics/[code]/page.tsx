"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import { fetchAdminData } from "@/app/admin/data-client"

type Analytics = { participants: number; completedTests: number; matches: number; messages: number }
const empty: Analytics = { participants: 0, completedTests: 0, matches: 0, messages: 0 }

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { setData(await fetchAdminData<Analytics>("analytics", code)); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Errore inatteso.") }
    finally { if (!silent) setLoading(false) }
  }, [code])
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(true), 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [load])
  const cards = [{ title: "Partecipanti", value: data.participants, icon: "👥" }, { title: "Test completati", value: data.completedTests, icon: "🎯" }, { title: "Match creati", value: data.matches, icon: "❤️" }, { title: "Messaggi", value: data.messages, icon: "💬" }]

  return <div className="flex min-h-screen bg-black text-white"><Sidebar /><main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">
    <h1 className="text-4xl font-bold text-pink-500 sm:text-5xl">📈 Analytics Live</h1><p className="mt-3 text-gray-400">Evento: {code}</p>
    {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/15 p-4 text-red-200">{error}</p>}
    {loading ? <p className="mt-8">Carico analytics...</p> : <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.title} className="rounded-3xl bg-white p-6 text-black"><div className="text-4xl">{card.icon}</div><h2 className="mt-4 text-gray-500">{card.title}</h2><p className="mt-2 text-5xl font-bold">{card.value}</p></article>)}</div>}
  </main></div>
}
