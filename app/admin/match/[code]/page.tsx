"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import { fetchAdminData } from "@/app/admin/data-client"

type Person = { nickname: string | null; avatar_url: string | null }
type Match = { id: string; persona1: Person | null; persona2: Person | null; status?: string | null; created_at?: string | null }

function initials(name?: string | null) { return (name || "?").trim().slice(0, 2).toUpperCase() }
function statusInfo(status?: string | null) { return status === "blocked" ? { label:"BLOCCATO", style:"border-red-400/25 bg-red-400/10 text-red-200" } : { label:"ATTIVO", style:"border-emerald-400/25 bg-emerald-400/10 text-emerald-200" } }

export default function Page() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { const data = await fetchAdminData<{ matches: Match[] }>("matches", code); setMatches(data.matches); setError("") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Errore inatteso.") }
    finally { if (!silent) setLoading(false) }
  }, [code])
  useEffect(() => { const initial=window.setTimeout(()=>void load(),0); const timer=window.setInterval(()=>void load(true),5000); return()=>{window.clearTimeout(initial);window.clearInterval(timer)} }, [load])
  const visible = useMemo(() => { const term=query.trim().toLowerCase(); return term ? matches.filter(match=>[match.persona1?.nickname,match.persona2?.nickname].some(name=>name?.toLowerCase().includes(term))) : matches }, [matches,query])
  const active = matches.filter(match=>match.status!=="blocked").length

  return <div className="flex min-h-screen bg-[#070508] text-white"><Sidebar /><main className="min-w-0 flex-1 px-4 pb-10 pt-20 sm:px-6 lg:p-8"><div className="mx-auto max-w-6xl">
    <header><p className="text-xs font-black uppercase tracking-[.2em] text-pink-400">Connessioni dell&apos;evento</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-black sm:text-5xl">Match</h1><p className="mt-3 text-sm text-white/45">Evento <span className="font-black uppercase text-white/70">{code}</span> · aggiornamento ogni 5 secondi</p></div><span className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-black text-white/50">● LIVE</span></div></header>
    {error&&<p role="alert" className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    <section className="mt-8 grid gap-3 sm:grid-cols-3"><Stat label="Match totali" value={matches.length} tone="pink"/><Stat label="Attivi" value={active} tone="green"/><Stat label="Bloccati" value={matches.length-active} tone="neutral"/></section>
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[.035] p-4 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">Elenco connessioni</h2><p className="mt-1 text-sm text-white/40">Ogni scheda rappresenta una coppia collegata.</p></div><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cerca partecipante…" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-pink-400/50 sm:max-w-xs" /></div>
      {loading?<div className="mt-6 grid gap-4 md:grid-cols-2">{[0,1,2,3].map(item=><div key={item} className="h-52 animate-pulse rounded-2xl bg-white/[.05]" />)}</div>:visible.length?<div className="mt-6 grid gap-4 md:grid-cols-2">{visible.map((match,index)=><MatchCard key={match.id} match={match} number={index+1}/>)}</div>:<div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center"><p className="text-lg font-black">{query?"Nessun risultato":"Nessun match ancora"}</p><p className="mt-2 text-sm text-white/35">{query?"Prova un altro nome.":"Le nuove connessioni compariranno qui automaticamente."}</p></div>}
    </section>
  </div></main></div>
}

function Stat({label,value,tone}:{label:string;value:number;tone:"pink"|"green"|"neutral"}) { const style=tone==="pink"?"border-pink-400/20 bg-pink-500/[.08] text-pink-300":tone==="green"?"border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300":"border-white/10 bg-white/[.035] text-white/45"; return <div className={`rounded-2xl border p-5 ${style}`}><p className="text-xs font-black uppercase tracking-wider">{label}</p><p className="mt-2 text-4xl font-black text-white">{value}</p></div> }

function MatchCard({match,number}:{match:Match;number:number}) { const state=statusInfo(match.status); return <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-3"><span className="text-xs font-black text-white/35">MATCH #{String(number).padStart(2,"0")}</span><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${state.style}`}>{state.label}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-5"><Person person={match.persona1}/><div className="flex h-11 w-11 items-center justify-center rounded-full border border-pink-400/25 bg-pink-500/10 text-lg text-pink-300">♥</div><Person person={match.persona2}/></div><div className="flex items-center justify-between border-t border-white/[.07] px-5 py-3 text-[11px] text-white/30"><span>{match.created_at?new Date(match.created_at).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"}):"Data non disponibile"}</span><span className="font-mono">ID {match.id.slice(0,8)}</span></div></article> }

function Person({person}:{person:Person|null}) { return <div className="min-w-0 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white/10 bg-gradient-to-br from-fuchsia-600/30 to-orange-400/20 text-xl font-black">{person?.avatar_url?<img src={person.avatar_url} alt={`Avatar di ${person.nickname||"partecipante"}`} className="h-full w-full object-cover"/>:initials(person?.nickname)}</div><p className="mt-3 truncate font-black">{person?.nickname||"Partecipante"}</p></div> }
