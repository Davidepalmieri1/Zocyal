"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import Sidebar from "@/app/admin/components/Sidebar"
import { fetchAdminData } from "@/app/admin/data-client"

type Participant = {
  id: string
  nickname: string | null
  age: number | null
  goal: string | null
  avatar_url: string | null
  completed_test: boolean | null
}

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchAdminData<{ participants: Participant[] }>("participants", code)
      setParticipants(data.participants)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore inatteso.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [code])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => void load(true), 5000)
    return () => { window.clearTimeout(initial); window.clearInterval(timer) }
  }, [load])

  const filtered = participants.filter((person) =>
    person.nickname?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">
        <h1 className="text-4xl font-bold text-pink-500 sm:text-5xl">👥 Partecipanti</h1>
        <p className="mt-3 text-gray-400">Evento: {code}</p>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca partecipante..." className="my-8 w-full max-w-xl rounded-xl bg-white p-4 text-black outline-none" />
        {error && <p role="alert" className="mb-6 rounded-xl bg-red-500/15 p-4 text-red-200">{error}</p>}
        {loading ? <p>Carico partecipanti...</p> : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((person, index) => (
              <motion.article key={person.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.3) }} className="rounded-3xl bg-white p-6 text-black shadow-xl">
                {person.avatar_url && <img src={person.avatar_url} alt="" className="mx-auto mb-4 h-24 w-24 rounded-full object-cover" />}
                <h2 className="text-center text-2xl font-bold">{person.nickname || "Senza nome"}</h2>
                <p className="text-center">{person.age || "?"} anni</p>
                <p className="mt-2 text-center text-gray-500">🎯 {person.goal || "Nessun obiettivo"}</p>
                <p className="mt-5 text-center font-bold">{person.completed_test ? "✅ Test completato" : "⏳ Test incompleto"}</p>
              </motion.article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
