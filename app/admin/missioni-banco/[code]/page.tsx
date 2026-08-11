"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { fetchAdminData } from "@/app/admin/data-client"

type Mission={id:string;title:string;description:string;points:number;verification_mode:"automatic"|"manual";active:boolean}
type Person={id:string;nickname:string|null}
type Completion={mission_id:string;participant_id:string}
type Data={missions:Mission[];participants:Person[];completions:Completion[]}

export default function MissioniBancoPage(){
  const {code:raw}=useParams<{code:string}>(),code=raw.toLowerCase()
  const [data,setData]=useState<Data|null>(null),[query,setQuery]=useState(""),[person,setPerson]=useState<Person|null>(null),[mission,setMission]=useState<Mission|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("")
  const load=useCallback(async()=>setData(await fetchAdminData<Data>("rewards",code)),[code])
  useEffect(()=>{const timer=window.setTimeout(()=>void load().catch(e=>setError(e instanceof Error?e.message:"Caricamento non riuscito.")),0);return()=>window.clearTimeout(timer)},[load])

  const people=useMemo(()=>{const term=query.trim().toLocaleLowerCase("it");return(data?.participants||[]).filter(item=>!term||(item.nickname||"").toLocaleLowerCase("it").includes(term)).slice(0,30)},[data,query])
  const available=useMemo(()=>{if(!person||!data)return[];const completed=new Set(data.completions.filter(item=>item.participant_id===person.id).map(item=>item.mission_id));return data.missions.filter(item=>item.active&&item.verification_mode==="manual"&&!completed.has(item.id))},[data,person])

  function reset(){setQuery("");setPerson(null);setMission(null);setSuccess("");setError("")}
  async function approve(){if(!person||!mission||busy)return;setBusy(true);setError("");try{const response=await fetch("/admin/api/rewards",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"approve_manual",event_code:code,participant_id:person.id,mission_id:mission.id,note:"Assegnato dalla modalitÃ  Punti staff"})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Assegnazione non riuscita.");setSuccess(`${mission.points} punti assegnati a ${person.nickname||"partecipante"}.`);setMission(null);await load()}catch(e){setError(e instanceof Error?e.message:"Assegnazione non riuscita.")}finally{setBusy(false)}}

  return <main className="premium-page min-h-screen px-4 py-5 text-white sm:px-6"><PremiumBackdrop/><div className="relative mx-auto w-full max-w-lg">
    <header className="flex items-center justify-between gap-4"><div><p className="premium-eyebrow">ModalitÃ  staff</p><h1 className="mt-2 text-3xl font-black">Assegna punti</h1></div><Link href={`/admin/premi/${code}`} className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black text-white/65">GESTIONE</Link></header>
    {error&&<p role="alert" className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    {success?<section className="mt-6 rounded-[2rem] border border-emerald-400/30 bg-emerald-400/10 p-7 text-center"><p className="text-5xl">âœ“</p><h2 className="mt-3 text-2xl font-black">Punti assegnati</h2><p className="mt-2 text-emerald-100/70">{success}</p><button onClick={reset} className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-black">ASSEGNA AL PROSSIMO</button></section>:
    !person?<section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7"><div className="text-center"><span className="text-5xl">ðŸ‘¤</span><h2 className="mt-4 text-2xl font-black">Chi ha completato la missione?</h2><p className="mt-2 text-sm text-white/45">Cerca il partecipante per nome.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} autoFocus placeholder="Scrivi il nomeâ€¦" className="mt-6 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg font-bold outline-none focus:border-orange-300/50"/><div className="mt-4 grid gap-2">{people.map(item=><button key={item.id} onClick={()=>{setPerson(item);setQuery("")}} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left font-black hover:border-orange-300/40 hover:bg-orange-300/10"><span>{item.nickname||"Partecipante"}</span><span className="text-2xl text-white/30">â€º</span></button>)}</div></section>:
    !mission?<section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7"><button onClick={()=>setPerson(null)} className="text-xs font-black text-white/45">â€¹ CAMBIA PERSONA</button><p className="mt-5 text-xs font-black uppercase tracking-wider text-orange-300">Partecipante</p><h2 className="mt-1 text-3xl font-black">{person.nickname||"Partecipante"}</h2><p className="mt-5 text-sm text-white/45">Seleziona la missione completata.</p><div className="mt-4 grid gap-3">{available.map(item=><button key={item.id} onClick={()=>setMission(item)} className="rounded-2xl border border-orange-300/20 bg-orange-300/[.07] p-5 text-left hover:bg-orange-300/15"><div className="flex justify-between gap-4"><div><h3 className="font-black">{item.title}</h3><p className="mt-1 text-sm text-white/40">{item.description}</p></div><span className="shrink-0 text-xl font-black text-orange-300">+{item.points}</span></div></button>)}{!available.length&&<p className="rounded-2xl border border-dashed border-white/15 p-7 text-center text-white/40">Nessuna missione manuale ancora da assegnare a questa persona.</p>}</div></section>:
    <section className="mt-6 rounded-[2rem] border border-orange-300/25 bg-orange-300/[.08] p-6 text-center"><p className="text-xs font-black uppercase tracking-wider text-orange-300">Conferma assegnazione</p><h2 className="mt-3 text-2xl font-black">{mission.title}</h2><p className="mt-2 text-white/50">a {person.nickname||"Partecipante"}</p><p className="mt-6 text-6xl font-black text-orange-300">+{mission.points}</p><p className="mt-1 text-sm font-bold text-orange-100/60">punti</p><button disabled={busy} onClick={()=>void approve()} className="mt-6 w-full rounded-2xl bg-orange-400 px-5 py-4 text-sm font-black text-black disabled:opacity-50">{busy?"ASSEGNOâ€¦":"CONFERMA E ASSEGNA PUNTI"}</button><button disabled={busy} onClick={()=>setMission(null)} className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-4 text-sm font-black">INDIETRO</button></section>}
  </div></main>
}
