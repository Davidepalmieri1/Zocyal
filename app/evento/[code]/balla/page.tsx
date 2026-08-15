"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import { publicSupabase, supabase } from "@/lib/supabase"

const STYLES = [
  ["salsa_cubana", "Salsa cubana"], ["salsa_portoricana", "Salsa portoricana"],
  ["bachata", "Bachata"], ["bachata_sensual", "Bachata Sensual"],
  ["merengue", "Merengue"], ["kizomba", "Kizomba"], ["balli_di_gruppo", "Balli di gruppo"],
] as const
const LEVELS = { beginner:"Principiante", intermediate:"Intermedio", advanced:"Avanzato" } as const
type Role="leader"|"follower"|"both"; type Level=keyof typeof LEVELS
type Dancer={participant_id:string;role:Role;skills:Record<string,Level>;available:boolean;participant:{nickname:string;avatar_url:string|null}|null}
type Invite={id:string;sender_id:string;receiver_id:string;style:string;status:string;created_at:string;sender:{nickname:string}|null;receiver:{nickname:string}|null}
type DanceProfileRow=Omit<Dancer,"participant">
type InviteRow=Omit<Invite,"sender"|"receiver">
type PersonRow={id:string;nickname:string;avatar_url:string|null}

export default function DancePage(){
  const {code:raw}=useParams<{code:string}>(),code=raw.toLowerCase(),router=useRouter()
  const [mine,setMine]=useState(""); const [role,setRole]=useState<Role>("both"); const [skills,setSkills]=useState<Record<string,Level>>({})
  const [available,setAvailable]=useState(true); const [dancers,setDancers]=useState<Dancer[]>([]); const [invites,setInvites]=useState<Invite[]>([])
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(""); const [message,setMessage]=useState(""); const [profileFeedback,setProfileFeedback]=useState("")
  const labels=useMemo(()=>new Map<string,string>(STYLES),[])
  const load=useCallback(async(id:string)=>{
    const [profilesResult,invitesResult]=await Promise.all([
      supabase.from("participant_dance_profiles").select("participant_id,role,skills,available"),
      supabase.from("dance_invitations").select("id,sender_id,receiver_id,style,status,created_at").or(`sender_id.eq.${id},receiver_id.eq.${id}`).order("created_at",{ascending:false}).limit(30),
    ])
    if(profilesResult.error)throw profilesResult.error;if(invitesResult.error)throw invitesResult.error
    const profileRows=(profilesResult.data||[]) as DanceProfileRow[]
    const inviteRows=(invitesResult.data||[]) as InviteRow[]
    const personIds=[...new Set([...profileRows.map(item=>item.participant_id),...inviteRows.flatMap(item=>[item.sender_id,item.receiver_id])])]
    const peopleResult=personIds.length
      ? await supabase.from("participants").select("id,nickname,avatar_url").in("id",personIds)
      : {data:[] as PersonRow[],error:null}
    if(peopleResult.error)throw peopleResult.error
    const people=new Map((peopleResult.data||[]).map(person=>[person.id,person as PersonRow]))
    const profiles:Dancer[]=profileRows.map(profile=>({...profile,participant:people.get(profile.participant_id)||null}))
    const loadedInvites:Invite[]=inviteRows.map(invite=>({...invite,sender:people.get(invite.sender_id)||null,receiver:people.get(invite.receiver_id)||null}))
    const own=profiles.find(item=>item.participant_id===id)
    if(own){setRole(own.role);setSkills(own.skills);setAvailable(own.available)}
    setDancers(profiles.filter(item=>item.participant_id!==id));setInvites(loadedInvites)
  },[])
  useEffect(()=>{let active=true;(async()=>{try{
    const event=await publicSupabase.from("events").select("experience_mode").eq("code",code).maybeSingle()
    if(event.data?.experience_mode!=="caribbean"){router.replace(`/evento/${code}`);return}
    const id=await resolveCurrentParticipant(code);if(!id)throw new Error("Profilo partecipante non trovato.");if(!active)return
    setMine(id);await load(id)
  }catch(error){if(active){const detail=error&&typeof error==="object"&&"message" in error?String(error.message):"";setMessage(detail||"Impossibile aprire la pista.")}}finally{if(active)setLoading(false)}})();return()=>{active=false}},[code,load,router])
  async function save(){
    if(!mine){setProfileFeedback("Profilo partecipante non disponibile. Ricarica la pagina.");return}
    if(!Object.keys(skills).length){setProfileFeedback("Seleziona almeno uno stile di ballo.");return}
    setBusy("profile");setProfileFeedback("")
    try{
      const {error}=await supabase.rpc("save_dance_profile",{p_event_code:code,p_role:role,p_skills:skills,p_available:available})
      if(error)throw error
      setProfileFeedback("Profilo di ballo salvato correttamente.")
      void load(mine).catch(error=>console.error("Aggiornamento pista non riuscito:",error))
    }catch(error){
      const detail=error&&typeof error==="object"&&"message" in error?String(error.message):""
      setProfileFeedback(detail||"Salvataggio non riuscito. Riprova.")
    }finally{setBusy("")}
  }
  function toggle(style:string){setSkills(current=>{const next={...current};if(next[style])delete next[style];else next[style]="beginner";return next})}
  async function invite(dancer:Dancer){const shared=Object.keys(skills).filter(style=>dancer.skills[style]);if(!shared.length){setMessage("Non avete ancora uno stile in comune.");return}setBusy(dancer.participant_id);setMessage("");const {error}=await supabase.rpc("send_dance_invitation",{p_event_code:code,p_receiver_id:dancer.participant_id,p_style:shared[0],p_message:null});if(error)setMessage(error.message.includes("Active invitation")?"Hai già un invito attivo.":error.message);else{await load(mine);setMessage(`Invito inviato per ${labels.get(shared[0])}.`)}setBusy("")}
  async function respond(id:string,response:"accepted"|"declined"|"later"){setBusy(id);const {error}=await supabase.rpc("respond_dance_invitation",{p_invitation_id:id,p_response:response});if(error)setMessage(error.message);else await load(mine);setBusy("")}
  const compatible=(dancer:Dancer)=>dancer.available&&Object.keys(skills).some(style=>dancer.skills[style])&&(role==="both"||dancer.role==="both"||role!==dancer.role)
  return <main className="relative min-h-screen overflow-hidden bg-[#050306] px-4 pb-28 pt-8 text-white sm:px-6"><PremiumBackdrop/><div className="relative mx-auto max-w-6xl"><Logo size="small"/><header className="mt-10"><p className="premium-eyebrow">Modalità caraibica</p><h1 className="premium-title mt-3 text-4xl font-black sm:text-6xl">Ci vediamo in pista.</h1><p className="mt-4 max-w-2xl text-white/50">Imposta ruolo e skill, trova ballerini compatibili e invita qualcuno a ballare. Un rifiuto non richiede spiegazioni.</p></header>
  {message&&<p role="status" className="mt-6 rounded-2xl border border-orange-300/20 bg-orange-300/10 p-4 text-orange-100">{message}</p>}
  <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[.04] p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Il mio profilo di ballo</h2><p className="mt-1 text-sm text-white/45">Puoi cambiare disponibilità in qualsiasi momento.</p></div><label className="flex items-center gap-3 rounded-full border border-white/10 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)} className="accent-orange-400"/>Disponibile a ballare</label></div>
  <div className="mt-5 grid gap-3 sm:grid-cols-3">{([['leader','Leader'],['follower','Follower'],['both','Entrambi']] as const).map(([value,label])=><button key={value} onClick={()=>setRole(value)} className={`rounded-2xl border p-3 font-black ${role===value?'border-orange-300/50 bg-orange-300/10 text-orange-200':'border-white/10 text-white/45'}`}>{label}</button>)}</div>
  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STYLES.map(([value,label])=><div key={value} className={`rounded-2xl border p-4 ${skills[value]?'border-pink-300/35 bg-pink-400/[.08]':'border-white/10'}`}><label className="flex items-center gap-3 font-black"><input type="checkbox" checked={Boolean(skills[value])} onChange={()=>toggle(value)} className="accent-pink-500"/>{label}</label>{skills[value]&&<select value={skills[value]} onChange={e=>setSkills(current=>({...current,[value]:e.target.value as Level}))} className="mt-3 w-full rounded-xl bg-white p-2 text-sm font-bold text-black">{Object.entries(LEVELS).map(([level,text])=><option key={level} value={level}>{text}</option>)}</select>}</div>)}</div>
  <button type="button" disabled={busy==="profile"||!mine} onClick={()=>void save()} className="premium-cta mt-6 rounded-full px-6 py-3 font-black disabled:cursor-wait disabled:opacity-60">{busy==="profile"?"SALVATAGGIO...":"SALVA PROFILO"}</button>{profileFeedback&&<p role="status" className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-300/10 p-4 text-sm text-orange-100">{profileFeedback}</p>}</section>
  <section className="mt-8"><h2 className="text-2xl font-black">Inviti ricevuti</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{invites.filter(i=>i.receiver_id===mine&&i.status==="pending").map(invite=><article key={invite.id} className="rounded-3xl border border-orange-300/20 bg-orange-300/[.07] p-5"><p className="text-xs font-black uppercase tracking-wider text-orange-200">{labels.get(invite.style)}</p><h3 className="mt-2 text-xl font-black">{invite.sender?.nickname||"Qualcuno"} ti invita a ballare</h3><div className="mt-5 flex flex-wrap gap-2"><button disabled={busy===invite.id} onClick={()=>void respond(invite.id,"accepted")} className="premium-cta rounded-full px-4 py-2 font-black">ACCETTA</button><button onClick={()=>void respond(invite.id,"later")} className="rounded-full border border-white/15 px-4 py-2 font-black">PIÙ TARDI</button><button onClick={()=>void respond(invite.id,"declined")} className="rounded-full px-4 py-2 text-sm text-white/45">RIFIUTA</button></div></article>)}{!invites.some(i=>i.receiver_id===mine&&i.status==="pending")&&<p className="rounded-3xl border border-dashed border-white/15 p-6 text-white/40">Nessun invito in attesa.</p>}</div></section>
  <section className="mt-8"><h2 className="text-2xl font-black">Ballerini disponibili</h2><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{loading?<div className="h-48 animate-pulse rounded-3xl bg-white/[.04]"/>:dancers.filter(compatible).map(dancer=><article key={dancer.participant_id} className="rounded-3xl border border-white/10 bg-white/[.04] p-5"><div className="flex items-center gap-3">{dancer.participant?.avatar_url?<img src={dancer.participant.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover"/>:<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-300/10 text-2xl">♫</span>}<div><h3 className="text-xl font-black">{dancer.participant?.nickname||"Ballerino"}</h3><p className="text-xs uppercase text-orange-200">{dancer.role==='both'?'Leader · Follower':dancer.role}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{Object.keys(dancer.skills).filter(style=>skills[style]).map(style=><span key={style} className="rounded-full bg-pink-400/10 px-3 py-1 text-xs text-pink-200">{labels.get(style)}</span>)}</div><button disabled={Boolean(busy)} onClick={()=>void invite(dancer)} className="mt-5 w-full rounded-full border border-orange-300/30 bg-orange-300/10 px-4 py-3 font-black text-orange-100">INVITA A BALLARE</button></article>)}{!loading&&!dancers.some(compatible)&&<p className="rounded-3xl border border-dashed border-white/15 p-8 text-white/40">Completa il profilo o attendi che altri ballerini diventino disponibili.</p>}</div></section>
  </div></main>
}
