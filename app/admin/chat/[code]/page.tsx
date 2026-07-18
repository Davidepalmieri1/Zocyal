"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import { fetchAdminData } from "@/app/admin/data-client"

type Message = { id: string; message: string; match_id: string; mittente: { nickname: string | null } | null }

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { const data = await fetchAdminData<{ messages: Message[] }>("chat", code); setMessages(data.messages); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Errore inatteso.") }
    finally { if (!silent) setLoading(false) }
  }, [code])
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(true), 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [load])

  return <div className="flex min-h-screen bg-black text-white"><Sidebar /><main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">
    <h1 className="text-4xl font-bold text-pink-500 sm:text-5xl">💬 Chat Live</h1><p className="mt-3 text-gray-400">Evento: {code}</p>
    {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/15 p-4 text-red-200">{error}</p>}
    <div className="my-8 rounded-3xl border border-white/20 bg-white/10 p-6 text-3xl font-bold">💬 {messages.length} <span className="text-base text-gray-400">messaggi totali</span></div>
    {loading ? <p>Carico chat...</p> : <div className="flex flex-col gap-4">{messages.map((message) => <article key={message.id} className="rounded-2xl bg-white p-5 text-black"><p className="font-bold">{message.mittente?.nickname || "Utente"}</p><p className="mt-2 whitespace-pre-wrap break-words">{message.message}</p><p className="mt-3 text-xs text-gray-500">Match ID: {message.match_id}</p></article>)}{messages.length === 0 && <p className="rounded-3xl bg-white/10 p-8 text-center">Nessun messaggio ancora</p>}</div>}
  </main></div>
}
