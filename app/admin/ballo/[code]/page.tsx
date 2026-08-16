"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Sidebar from "@/app/admin/components/Sidebar"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { fetchAdminData } from "@/app/admin/data-client"

type Person = { id:string; nickname:string|null; avatar_url:string|null }
type DanceProfile = { participant_id:string; role:string; skills:Record<string,string>; available:boolean; updated_at:string; participant:Person|null }
type DanceInvite = { id:string; sender_id:string; receiver_id:string; style:string; status:string; created_at:string; expires_at:string; sender:Person|null; receiver:Person|null }
type DanceData = { event:{name:string|null;code:string}; profiles:DanceProfile[]; invitations:DanceInvite[] }

const STYLE_LABELS:Record<string,string> = {
  salsa_cubana:"Salsa cubana", salsa_portoricana:"Salsa portoricana",
  bachata:"Bachata", bachata_sensual:"Bachata Sensual", merengue:"Merengue",
  kizomba:"Kizomba", balli_di_gruppo:"Balli di gruppo",
}
const ROLE_LABELS:Record<string,string> = { leader:"Leader", follower:"Follower", both:"Leader · Follower" }

export default function AdminDancePage() {
  const {code:rawCode}=useParams<{code:string}>()
  const code=rawCode.trim().toLowerCase()
  const [data,setData]=useState<DanceData|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")

  const load=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true)
    try{setData(await fetchAdminData<DanceData>("dance",code));setError("")}
    catch(cause){setError(cause instanceof Error?cause.message:"Pista non disponibile.")}
    finally{if(!silent)setLoading(false)}
  },[code])

  useEffect(()=>{const initial=window.setTimeout(()=>void load(),0);const timer=window.setInterval(()=>{if(!document.hidden)void load(true)},10000);return()=>{window.clearTimeout(initial);window.clearInterval(timer)}},[load])

  const pending=useMemo(()=>data?.invitations.filter(invite=>invite.status==="pending")||[],[data])
  const accepted=useMemo(()=>data?.invitations.filter(invite=>invite.status==="accepted")||[],[data])
  const available=data?.profiles.filter(profile=>profile.available).length||0

  return <div className="flex min-h-screen bg-[#050306] text-white"><Sidebar/><main className="premium-page relative min-w-0 flex-1 px-4 pb-12 pt-20 sm:px-6 lg:p-8"><PremiumBackdrop orbs={false}/><div className="relative mx-auto max-w-[1500px]">
    <header className="premium-enter flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="premium-eyebrow">Controllo caraibico</p><h1 className="premium-title mt-3 text-4xl font-black sm:text-6xl">Pista live.</h1><p className="mt-3 text-white/45">Disponibilità, skill e inviti dell’evento {data?.event.name||code}.</p></div><button type="button" onClick={()=>void load()} className="rounded-xl border border-white/10 bg-white/[.05] px-5 py-3 text-xs font-black">AGGIORNA</button></header>
    {error&&<p role="alert" className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    {loading?<div className="mt-7 h-60 animate-pulse rounded-[2rem] bg-white/[.04]"/>:data&&<>
      <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Profili ballo",data.profiles.length,"💃"],["Disponibili",available,"●"],["Inviti in attesa",pending.length,"⏳"],["Balli accettati",accepted.length,"✓"],
      ].map(([label,value,icon])=><article key={String(label)} className="rounded-[1.75rem] border border-white/[.08] bg-white/[.035] p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-white/40">{label}</p><span>{icon}</span></div><p className="mt-6 text-4xl font-black">{value}</p></article>)}</section>
      <section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="premium-eyebrow">Ballerini</p><h2 className="mt-2 text-2xl font-black">Profili in pista</h2></div><span className="text-sm text-white/40">{available} disponibili</span></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.profiles.map(profile=><article key={profile.participant_id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-pink-400/10">{profile.participant?.avatar_url?<Image src={profile.participant.avatar_url} alt="" width={48} height={48} className="h-full w-full object-cover"/>:"♫"}</div><div className="min-w-0"><h3 className="truncate font-black">{profile.participant?.nickname||"Partecipante"}</h3><p className="text-xs text-orange-200">{ROLE_LABELS[profile.role]||profile.role}</p></div><span className={`ml-auto h-2.5 w-2.5 rounded-full ${profile.available?"bg-emerald-300":"bg-white/20"}`}/></div><div className="mt-4 flex flex-wrap gap-1.5">{Object.keys(profile.skills).map(style=><span key={style} className="rounded-full bg-white/[.06] px-2.5 py-1 text-[10px] text-white/55">{STYLE_LABELS[style]||style}</span>)}</div></article>)}{!data.profiles.length&&<p className="text-sm text-white/35">Nessun profilo di ballo creato.</p>}</div></section>
      <section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7"><p className="premium-eyebrow">Ultime attività</p><h2 className="mt-2 text-2xl font-black">Inviti a ballare</h2><div className="mt-5 space-y-2">{data.invitations.slice(0,50).map(invite=><article key={invite.id} className="flex flex-col gap-3 rounded-2xl border border-white/[.08] bg-black/20 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><strong>{invite.sender?.nickname||"Partecipante"} → {invite.receiver?.nickname||"Partecipante"}</strong><p className="mt-1 text-xs text-white/40">{STYLE_LABELS[invite.style]||invite.style}</p></div><span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${invite.status==="accepted"?"bg-emerald-300/10 text-emerald-200":invite.status==="pending"?"bg-amber-300/10 text-amber-200":"bg-white/[.06] text-white/40"}`}>{invite.status}</span></article>)}{!data.invitations.length&&<p className="text-sm text-white/35">Nessun invito registrato.</p>}</div></section>
    </>}
  </div></main></div>
}
