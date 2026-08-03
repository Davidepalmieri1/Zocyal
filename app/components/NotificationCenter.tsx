"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import { supabase } from "@/lib/supabase"

type Notice = { id:string; kind:"match"|"message"|"table"|"reward"; title:string; detail:string; href:string }
type MatchRow = { id:string; user_one:string; user_two:string; created_at:string|null }

export default function NotificationCenter() {
  const { code: rawCode } = useParams<{code:string}>()
  const code = rawCode.trim().toLowerCase()
  const [open,setOpen]=useState(false)
  const [notices,setNotices]=useState<Notice[]>([])
  const [permission,setPermission]=useState<NotificationPermission|"unsupported">("unsupported")
  const knownIds=useRef<Set<string>>(new Set())
  const initialized=useRef(false)
  const participantIdRef=useRef("")
  const matchIdsRef=useRef<Set<string>>(new Set())

  const load=useCallback(async()=>{
    const participantId=await resolveCurrentParticipant(code)
    if(!participantId){setNotices([]);return}
    participantIdRef.current=participantId
    const matchesResult=await supabase.from("matches").select("id,user_one,user_two,created_at").or(`user_one.eq.${participantId},user_two.eq.${participantId}`).neq("status","blocked").order("created_at",{ascending:false}).limit(10)
    const matches=(matchesResult.data||[]) as MatchRow[]
    const matchIds=matches.map(match=>match.id)
    matchIdsRef.current=new Set(matchIds)
    const [messagesResult,invitesResult,rewardsResult]=await Promise.all([
      supabase.rpc("get_unread_notification_messages",{p_event_code:code}),
      supabase.from("game_table_invitations").select("id,table:game_tables(name,game)").eq("participant_id",participantId).eq("status","pending").order("invited_at",{ascending:false}),
      supabase.rpc("get_missions_rewards_for_event",{p_event_code:code}),
    ])
    const seenAt=Number(localStorage.getItem(`zocyal_matches_seen_${code}`)||0)
    const matchNotices=matches.filter(match=>new Date(match.created_at||0).getTime()>seenAt).map(match=>({id:`match-${match.id}`,kind:"match" as const,title:"Nuovo match",detail:"Hai una nuova connessione.",href:`/evento/${code}/miei-match`}))
    const messageNotices=((messagesResult.data||[]) as Array<{id:string;match_id:string;message:string|null}>).map(message=>({id:`message-${message.id}`,kind:"message" as const,title:"Nuovo messaggio",detail:String(message.message||"Apri la chat per leggerlo."),href:`/evento/${code}/chat/${message.match_id}`}))
    const inviteNotices=(invitesResult.data||[]).map(invite=>{const table=invite.table as unknown as {name?:string;game?:string}|null;return{id:`table-${invite.id}`,kind:"table" as const,title:"Invito al tavolo",detail:table?.name||table?.game||"Hai un nuovo invito.",href:`/evento/${code}/tavoli`}})
    const rewards=((rewardsResult.data as {rewards?:Array<{id:string;name:string;redeemed:boolean;redemption_status?:string}>}|null)?.rewards||[]).filter(reward=>reward.redeemed&&reward.redemption_status==="redeemed").map(reward=>({id:`reward-${reward.id}`,kind:"reward" as const,title:"Premio da ritirare",detail:reward.name||"Mostra il codice allo staff.",href:`/evento/${code}/missioni`}))
    const next=[...messageNotices,...matchNotices,...inviteNotices,...rewards]
    if(initialized.current&&"Notification" in window&&Notification.permission==="granted"){
      const fresh=next.filter(item=>!knownIds.current.has(item.id))
      if(fresh.length){const first=fresh[0];new Notification(first.title,{body:fresh.length===1?first.detail:`Hai ${fresh.length} nuove notifiche su ZOCYAL.`})}
    }
    knownIds.current=new Set(next.map(item=>item.id));initialized.current=true;setNotices(next)
  },[code])

  useEffect(()=>{
    const refresh=()=>{if(!document.hidden)void load()}
    const initial=window.setTimeout(()=>{setPermission("Notification" in window?Notification.permission:"unsupported");void load()},0)
    // Same resilient fallback used by “Le tue connessioni”: realtime remains
    // immediate, polling covers suspended mobile sockets and network changes.
    const id=window.setInterval(refresh,2000)
    const channel=supabase
      .channel(`notification-center-${code}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"matches"},payload=>{
        const match=(payload.new||payload.old) as {id?:string;user_one?:string;user_two?:string}
        if(match.user_one===participantIdRef.current||match.user_two===participantIdRef.current){if(match.id)matchIdsRef.current.add(match.id);void load()}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},payload=>{
        const message=payload.new as {id?:string;match_id?:string;message?:string;sender_id?:string}
        if(!message.id||!message.match_id||message.sender_id===participantIdRef.current||!matchIdsRef.current.has(message.match_id))return
        const notice:Notice={id:`message-${message.id}`,kind:"message",title:"Nuovo messaggio",detail:message.message||"Apri la chat per leggerlo.",href:`/evento/${code}/chat/${message.match_id}`}
        knownIds.current.add(notice.id)
        setNotices(current=>current.some(item=>item.id===notice.id)?current:[notice,...current])
        if("Notification" in window&&Notification.permission==="granted")new Notification(notice.title,{body:notice.detail})
        window.setTimeout(()=>void load(),100)
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"game_table_invitations"},payload=>{
        const invitation=(payload.new||payload.old) as {participant_id?:string}
        if(invitation.participant_id===participantIdRef.current)void load()
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"reward_redemptions"},()=>void load())
      .subscribe()
    document.addEventListener("visibilitychange",refresh)
    window.addEventListener("focus",refresh)
    window.addEventListener("online",refresh)
    return()=>{
      window.clearTimeout(initial);window.clearInterval(id)
      document.removeEventListener("visibilitychange",refresh)
      window.removeEventListener("focus",refresh)
      window.removeEventListener("online",refresh)
      void supabase.removeChannel(channel)
    }
  },[code,load])
  const count=notices.length
  const grouped=useMemo(()=>notices.slice(0,30),[notices])
  async function enable(){if(!("Notification" in window))return;const result=await Notification.requestPermission();setPermission(result);localStorage.setItem("zocyal_chat_notifications",String(result==="granted"))}
  function toggle(){const next=!open;setOpen(next);if(next){localStorage.setItem(`zocyal_matches_seen_${code}`,String(Date.now()));setNotices(current=>current.filter(item=>item.kind!=="match"))}}
  const icons={match:"♥",message:"💬",table:"🎲",reward:"🎁"}

  return <div className="fixed right-4 top-4 z-[70] sm:right-6 sm:top-5"><button type="button" onClick={toggle} aria-label={`Notifiche${count?`, ${count} nuove`:""}`} aria-expanded={open} className="relative flex h-13 min-h-13 w-13 min-w-13 items-center justify-center rounded-2xl border border-pink-300/35 bg-[#160c18]/90 text-2xl text-white shadow-[0_12px_40px_rgba(236,72,153,.25)] backdrop-blur-xl transition hover:scale-105 hover:border-pink-300/70">🔔{count>0&&<span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#070508] bg-pink-500 px-1 text-[10px] font-black text-white">{count>99?"99+":count}</span>}</button>{open&&<><button aria-label="Chiudi notifiche" onClick={()=>setOpen(false)} className="fixed inset-0 -z-10 bg-black/35 backdrop-blur-[2px]"/><section className="absolute right-0 mt-3 w-[min(92vw,390px)] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#100a12]/95 shadow-2xl backdrop-blur-2xl"><header className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-pink-300">Centro notifiche</p><h2 className="mt-1 text-xl font-black">Le tue novità</h2></div><button onClick={()=>setOpen(false)} className="h-9 w-9 rounded-full bg-white/[.06] text-xl">×</button></header>{permission!=="granted"&&<button onClick={()=>void enable()} className="m-4 w-[calc(100%-2rem)] rounded-xl border border-pink-300/25 bg-pink-500/10 px-4 py-3 text-xs font-black text-pink-200">ATTIVA NOTIFICHE DEL BROWSER</button>}<div className="max-h-[65vh] overflow-y-auto p-3">{grouped.length?grouped.map(item=><Link key={item.id} href={item.href} onClick={()=>setOpen(false)} className="flex gap-3 rounded-2xl p-3 transition hover:bg-white/[.06]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-xl">{icons[item.kind]}</span><span className="min-w-0"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block truncate text-xs text-white/45">{item.detail}</span></span></Link>):<div className="p-8 text-center"><p className="text-3xl">✓</p><p className="mt-3 font-black">Tutto sotto controllo</p><p className="mt-1 text-xs text-white/40">Non ci sono nuove notifiche.</p></div>}</div></section></>}</div>
}
