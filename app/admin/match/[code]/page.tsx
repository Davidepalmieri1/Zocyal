"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import { fetchAdminData } from "@/app/admin/data-client"

type Person = { nickname: string | null; avatar_url: string | null }
type Match = { id: string; persona1: Person | null; persona2: Person | null }

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchAdminData<{ matches: Match[] }>("matches", code)
      setMatches(data.matches); setError("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore inatteso.") }
    finally { if (!silent) setLoading(false) }
  }, [code])
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(true), 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [load])

  return <div className="flex min-h-screen bg-black text-white"><Sidebar /><main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">
    <h1 className="text-4xl font-bold text-pink-500 sm:text-5xl">❤️ Match</h1><p className="mt-3 text-gray-400">Evento: {code}</p>
    {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/15 p-4 text-red-200">{error}</p>}
    <div className="my-8 rounded-3xl border border-white/20 bg-white/10 p-6 text-3xl font-bold">🔥 {matches.length} <span className="text-base text-gray-400">match creati</span></div>
    {loading ? <p>Carico match...</p> : <div className="grid gap-6 md:grid-cols-2">{matches.map((match) => <article key={match.id} className="rounded-3xl bg-white p-6 text-black"><h2 className="mb-5 text-center text-xl font-bold">🔥 MATCH</h2><div className="flex items-center justify-center gap-5">{[match.persona1, match.persona2].map((person, index) => <div key={index} className="text-center">{person?.avatar_url && <img src={person.avatar_url} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />}<p className="mt-2 font-bold">{person?.nickname || "Utente"}</p></div>)}</div></article>)}</div>}
  </main></div>
}
