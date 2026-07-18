"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import { fetchAdminData } from "@/app/admin/data-client"

type Mission = { id:string; title:string; description:string; points:number; verification_mode:"automatic"|"manual"; active:boolean }
type Reward = { id:string; name:string; description:string; points_cost:number; quantity_total:number; reward_type:"threshold"|"podium_position"; threshold_points:number|null; podium_position:number|null; active:boolean }
type Person = { id:string; nickname:string|null }
type Leader = { nickname:string; avatar_url:string|null; points_earned:number; rank_position:number }
type Redemption = { id:string; status:string; redeemed_at:string; points_spent:number; reward:{name:string}|null; participant:{nickname:string|null}|null }
type Data = { missions:Mission[]; rewards:Reward[]; participants:Person[]; leaderboard:Leader[]; redemptions:Redemption[] }

const AUTOMATIC = [
  ["profile_completed", "Profilo completato"],
  ["questionnaire_completed", "Questionario completato"],
  ["matches_created", "Primo match"],
  ["messages_sent", "Primo messaggio"],
] as const

async function mutate(body: Record<string, unknown>, method = "POST") {
  const response = await fetch("/admin/api/rewards", { method, credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Operazione non riuscita.")
  return data
}

export default function RewardsAdminPage() {
  const { code: raw } = useParams<{code:string}>()
  const code = raw.toLowerCase()
  const [data,setData] = useState<Data|null>(null)
  const [tab,setTab] = useState<"missions"|"rewards"|"redemptions">("missions")
  const [error,setError] = useState("")
  const [busy,setBusy] = useState(false)
  const [missionMode,setMissionMode] = useState<"automatic"|"manual">("automatic")
  const [rewardType,setRewardType] = useState<"threshold"|"podium_position">("threshold")

  const load = useCallback(async()=>{ try { setData(await fetchAdminData<Data>("rewards",code)); setError("") } catch(e){setError(e instanceof Error?e.message:"Errore inatteso.")} },[code])
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load])

  async function submit(event:FormEvent<HTMLFormElement>, action:string) {
    event.preventDefault(); setBusy(true); setError("")
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const body:Record<string,unknown>={action,event_code:code}
    form.forEach((value,key)=>body[key]=value)
    for (const key of ["points","quantity_total","points_cost","threshold_points","podium_position"]) if (body[key]!==undefined) body[key]=Number(body[key])
    try { await mutate(body); formElement.reset(); await load() } catch(e){setError(e instanceof Error?e.message:"Errore inatteso.")} finally{setBusy(false)}
  }

  async function toggle(resource:"mission"|"reward", id:string, active:boolean){ setBusy(true); try{await mutate({resource,id,event_code:code,active},"PATCH");await load()}catch(e){setError(e instanceof Error?e.message:"Errore inatteso.")}finally{setBusy(false)} }
  async function remove(resource:"mission"|"reward", id:string){if(!window.confirm("Eliminare definitivamente questo elemento?"))return;setBusy(true);try{await mutate({resource,id,event_code:code},"DELETE");await load()}catch(e){setError(e instanceof Error?e.message:"Errore inatteso.")}finally{setBusy(false)}}

  const podium=[1,2,3].map(place=>({place, reward:data?.rewards.find(r=>r.reward_type==="podium_position"&&r.podium_position===place), leader:data?.leaderboard.find(l=>Number(l.rank_position)===place)}))

  return <div className="flex min-h-screen bg-black text-white"><Sidebar/><main className="min-w-0 flex-1 px-4 pb-16 pt-20 lg:p-8"><div className="mx-auto max-w-6xl">
    <p className="text-xs font-black uppercase tracking-[.2em] text-pink-400">Centro engagement</p><h1 className="mt-2 text-4xl font-black">Missioni, premi e riscatti</h1><p className="mt-3 text-zinc-400">Evento: {code}</p>
    {error&&<p className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}
    <nav className="mt-7 grid grid-cols-3 gap-2">{[["missions","Missioni"],["rewards","Premi"],["redemptions","Riscatti"]].map(([id,label])=><button key={id} onClick={()=>setTab(id as typeof tab)} className={`rounded-2xl border px-3 py-4 font-bold ${tab===id?"border-pink-400 bg-pink-500/15":"border-white/10 bg-white/[.04]"}`}>{label}</button>)}</nav>

    {tab==="missions"&&<div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={e=>submit(e,"create_mission")} className="rounded-3xl border border-white/10 bg-white/[.05] p-5"><h2 className="text-xl font-black">Nuova missione</h2>
        <label className="mt-5 block text-sm">Titolo<input name="title" required maxLength={120} className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label>
        <label className="mt-4 block text-sm">Descrizione<textarea name="description" className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label>
        <label className="mt-4 block text-sm">Punti<input name="points" type="number" min="1" defaultValue="10" required className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label>
        <label className="mt-4 block text-sm">Verifica<select name="verification_mode" value={missionMode} onChange={e=>setMissionMode(e.target.value as typeof missionMode)} className="mt-2 w-full rounded-xl bg-white p-3 text-black"><option value="automatic">Automatica</option><option value="manual">Approvazione staff</option></select></label>
        {missionMode==="automatic"&&<label className="mt-4 block text-sm">Evento verificato<select name="verification_key" className="mt-2 w-full rounded-xl bg-white p-3 text-black">{AUTOMATIC.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
        <button disabled={busy} className="mt-6 w-full rounded-xl bg-pink-500 px-4 py-3 font-black text-black">CREA MISSIONE</button>
      </form>
      <section><h2 className="text-2xl font-black">Missioni pubblicate</h2><div className="mt-4 grid gap-3">{data?.missions.map(m=><article key={m.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><div className="flex justify-between gap-4"><div><h3 className="font-black">{m.title}</h3><p className="mt-1 text-sm text-zinc-400">{m.description}</p><p className="mt-3 text-sm text-orange-300">+{m.points} punti · {m.verification_mode==="manual"?"Staff":"Automatica"}</p></div><div className="flex flex-col gap-2"><button disabled={busy} onClick={()=>toggle("mission",m.id,!m.active)} className={`h-10 rounded-full px-4 text-xs font-black ${m.active?"bg-green-400/15 text-green-300":"bg-zinc-700 text-zinc-300"}`}>{m.active?"ATTIVA":"SPENTA"}</button><button disabled={busy} onClick={()=>remove("mission",m.id)} className="rounded-full border border-red-400/30 px-4 py-2 text-xs font-black text-red-300">ELIMINA</button></div></div></article>)}</div></section>
    </div>}

    {tab==="rewards"&&<div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={e=>submit(e,"create_reward")} className="rounded-3xl border border-white/10 bg-white/[.05] p-5"><h2 className="text-xl font-black">Nuovo premio</h2>
        <label className="mt-5 block text-sm">Nome<input name="name" required className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label><label className="mt-4 block text-sm">Descrizione<textarea name="description" className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label>
        <label className="mt-4 block text-sm">Tipo<select name="reward_type" value={rewardType} onChange={e=>setRewardType(e.target.value as typeof rewardType)} className="mt-2 w-full rounded-xl bg-white p-3 text-black"><option value="threshold">Premio a soglia</option><option value="podium_position">Premio Top 3</option></select></label>
        {rewardType==="threshold"?<label className="mt-4 block text-sm">Punti richiesti<input name="threshold_points" type="number" min="0" defaultValue="30" className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label>:<label className="mt-4 block text-sm">Posizione<select name="podium_position" className="mt-2 w-full rounded-xl bg-white p-3 text-black"><option value="1">1°</option><option value="2">2°</option><option value="3">3°</option></select></label>}
        <label className="mt-4 block text-sm">Costo punti<input name="points_cost" type="number" min="0" defaultValue="0" className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label><label className="mt-4 block text-sm">Quantità<input name="quantity_total" type="number" min="1" defaultValue="1" className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label>
        <button disabled={busy} className="mt-6 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-4 py-3 font-black">CREA PREMIO</button>
      </form>
      <section><h2 className="text-2xl font-black">Podio Top 3</h2><div className="mt-4 grid grid-cols-3 items-end gap-2">{podium.map(({place,reward,leader})=><article key={place} className={`rounded-t-3xl border border-white/10 p-3 text-center ${place===1?"order-2 min-h-56 bg-amber-400/15":place===2?"order-1 min-h-48 bg-zinc-300/10":"order-3 min-h-40 bg-orange-500/10"}`}><p className="text-3xl font-black">{place}°</p><p className="mt-3 font-bold">{leader?.nickname||"—"}</p><p className="text-sm text-zinc-400">{leader?`${leader.points_earned} pt`:"Nessun punteggio"}</p><p className="mt-4 text-xs text-pink-300">{reward?.name||"Premio da configurare"}</p></article>)}</div>
        <h2 className="mt-8 text-2xl font-black">Catalogo premi</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{data?.rewards.map(r=><article key={r.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><h3 className="font-black">{r.name}</h3><p className="mt-2 text-sm text-zinc-400">{r.description}</p><p className="mt-4 text-sm">Quantità: {r.quantity_total} · Costo: {r.points_cost} pt</p><div className="mt-4 flex gap-2"><button onClick={()=>toggle("reward",r.id,!r.active)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black">{r.active?"ATTIVO":"SPENTO"}</button><button onClick={()=>remove("reward",r.id)} className="rounded-full border border-red-400/30 px-4 py-2 text-xs font-black text-red-300">ELIMINA</button></div></article>)}</div></section>
    </div>}

    {tab==="redemptions"&&<section className="mt-6"><h2 className="text-2xl font-black">Consegne premi</h2><div className="mt-4 grid gap-3">{data?.redemptions.length?data.redemptions.map(r=><article key={r.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">{r.reward?.name||"Premio"}</h3><p className="text-sm text-zinc-400">{r.participant?.nickname||"Partecipante"} · {r.points_spent} punti</p></div>{r.status==="redeemed"?<button disabled={busy} onClick={async()=>{setBusy(true);try{await mutate({action:"fulfill_redemption",event_code:code,redemption_id:r.id});await load()}finally{setBusy(false)}}} className="rounded-xl bg-green-400 px-4 py-3 font-black text-black">SEGNA CONSEGNATO</button>:<span className="font-bold text-green-300">CONSEGNATO ✓</span>}</article>):<p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-zinc-400">Nessun premio richiesto.</p>}</div></section>}

    {data?.missions.some(m=>m.verification_mode==="manual")&&<section className="mt-10 rounded-3xl border border-white/10 bg-white/[.04] p-5"><h2 className="text-xl font-black">Approva missione staff</h2><form onSubmit={e=>submit(e,"approve_manual")} className="mt-4 grid gap-3 sm:grid-cols-3"><select name="participant_id" required className="rounded-xl bg-white p-3 text-black"><option value="">Partecipante</option>{data.participants.map(p=><option key={p.id} value={p.id}>{p.nickname||p.id}</option>)}</select><select name="mission_id" required className="rounded-xl bg-white p-3 text-black"><option value="">Missione</option>{data.missions.filter(m=>m.verification_mode==="manual"&&m.active).map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select><button disabled={busy} className="rounded-xl bg-orange-400 p-3 font-black text-black">APPROVA E ASSEGNA PUNTI</button></form></section>}
  </div></main></div>
}
