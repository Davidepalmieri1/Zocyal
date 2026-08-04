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
  const loadingRef=useRef(false)
  const readKey=`zocyal_notifications_read_${code}`

  function readIds(){
    try{return new Set(JSON.parse(localStorage.getItem(readKey)||"[]") as string[])}catch{return new Set<string>()}
  }

  const load=useCallback(async()=>{
    if(loadingRef.current)return
    loadingRef.current=true
    try{
    const participantId=participantIdRef.current||await resolveCurrentParticipant(code)
    if(!participantId){setNotices([]);return}
    participantIdRef.current=participantId
    const matchesResult=await supabase.from("matches").select("id,user_one,user_two,created_at").or(`user_one.eq.${participantId},user_two.eq.${participantId}`).neq("status","blocked").order("created_at",{ascending:false})
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
    const alreadyRead=readIds()
    const next=[...messageNotices,...matchNotices,...inviteNotices,...rewards].filter(item=>!alreadyRead.has(item.id))
    if(initialized.current&&"Notification" in window&&Notification.permission==="granted"){
      const fresh=next.filter(item=>!knownIds.current.has(item.id))
      if(fresh.length){const first=fresh[0];new Notification(first.title,{body:fresh.length===1?first.detail:`Hai ${fresh.length} nuove notifiche su ZOCYAL.`})}
    }
    knownIds.current=new Set(next.map(item=>item.id));initialized.current=true;setNotices(next)
    }finally{loadingRef.current=false}
  },[code])

  useEffect(()=>{
    let active=true
    let id:number|null=null
    let realtimeReady=false
    let refreshTimeout:number|null=null
    let channel:ReturnType<typeof supabase.channel>|null=null
    const refresh=()=>{
      if(refreshTimeout!==null)window.clearTimeout(refreshTimeout)
      refreshTimeout=window.setTimeout(()=>{
        refreshTimeout=null
        void load().catch(error=>console.error("Sincronizzazione notifiche non riuscita:",error))
      },150)
    }
    const initial=window.setTimeout(()=>setPermission("Notification" in window?Notification.permission:"unsupported"),0)

    const start=async()=>{
      // Resolve the participant first: subscribing before auth restoration made
      // Realtime stay anonymous on pages that did not query chat data themselves.
      try{await load()}catch(error){console.error("Avvio notifiche non riuscito:",error)}
      const {data:{session}}=await supabase.auth.getSession()
      if(!active)return
      if(session?.access_token)supabase.realtime.setAuth(session.access_token)
      const participantId=participantIdRef.current
      if(!participantId)return
      const handleMessage=(raw:unknown)=>{
        const message=raw as {id?:string;match_id?:string;message?:string;sender_id?:string;receiver_id?:string}
        const intendedForMe=message.receiver_id
          ? message.receiver_id===participantIdRef.current
          : Boolean(message.match_id&&matchIdsRef.current.has(message.match_id))
        if(!message.id||!message.match_id||message.sender_id===participantIdRef.current||!intendedForMe)return
        const notice:Notice={id:`message-${message.id}`,kind:"message",title:"Nuovo messaggio",detail:message.message||"Apri la chat per leggerlo.",href:`/evento/${code}/chat/${message.match_id}`}
        if(readIds().has(notice.id))return
        knownIds.current.add(notice.id)
        setNotices(current=>current.some(item=>item.id===notice.id)?current:[notice,...current])
        if("Notification" in window&&Notification.permission==="granted")new Notification(notice.title,{body:notice.detail})
      }
      channel=supabase
      .channel(`participant-notifications-${participantId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"matches",filter:`user_one=eq.${participantId}`},payload=>{
        const match=(payload.new||payload.old) as {id?:string;user_one?:string;user_two?:string}
        if(match.user_one===participantIdRef.current||match.user_two===participantIdRef.current){if(match.id)matchIdsRef.current.add(match.id);refresh()}
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"matches",filter:`user_two=eq.${participantId}`},payload=>{
        const match=(payload.new||payload.old) as {id?:string;user_one?:string;user_two?:string}
        if(match.user_one===participantIdRef.current||match.user_two===participantIdRef.current){if(match.id)matchIdsRef.current.add(match.id);refresh()}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`receiver_id=eq.${participantId}`},payload=>{
        handleMessage(payload.new)
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"game_table_invitations",filter:`participant_id=eq.${participantId}`},payload=>{
        const invitation=(payload.new||payload.old) as {participant_id?:string}
        if(invitation.participant_id===participantIdRef.current)refresh()
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"reward_redemptions",filter:`participant_id=eq.${participantId}`},refresh)
      .subscribe(status=>{
        realtimeReady=status==="SUBSCRIBED"
        if(realtimeReady)refresh()
      })
      // Realtime handles normal traffic; this is only recovery for suspended
      // sockets, so it must stay inexpensive when many guests are connected.
      id=window.setInterval(()=>{if(!realtimeReady&&!document.hidden)refresh()},60000)
    }
    void start()
    const {data:authListener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(session?.access_token)supabase.realtime.setAuth(session.access_token)
      refresh()
    })
    const refreshWhenVisible=()=>{if(!document.hidden)refresh()}
    document.addEventListener("visibilitychange",refreshWhenVisible)
    window.addEventListener("focus",refresh)
    window.addEventListener("online",refresh)
    return()=>{
      active=false;window.clearTimeout(initial)
      if(refreshTimeout!==null)window.clearTimeout(refreshTimeout)
      if(id!==null)window.clearInterval(id)
      document.removeEventListener("visibilitychange",refreshWhenVisible)
      window.removeEventListener("focus",refresh)
      window.removeEventListener("online",refresh)
      authListener.subscription.unsubscribe()
      if(channel)void supabase.removeChannel(channel)
    }
  },[code,load])
  const count=open?0:notices.length
  const grouped=useMemo(()=>notices.slice(0,30),[notices])
  async function enable(){if(!("Notification" in window))return;const result=await Notification.requestPermission();setPermission(result);localStorage.setItem("zocyal_chat_notifications",String(result==="granted"))}
  function closeAndRead(){
    const read=readIds()
    notices.forEach(item=>read.add(item.id))
    localStorage.setItem(readKey,JSON.stringify([...read].slice(-500)))
    localStorage.setItem(`zocyal_matches_seen_${code}`,String(Date.now()))
    knownIds.current=new Set()
    setOpen(false)
    setNotices([])
  }
  function toggle(){if(open)closeAndRead();else setOpen(true)}
  const icons={match:"♥",message:"💬",table:"🎲",reward:"🎁"}

  return <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] z-[70] sm:right-6 sm:top-5"><button type="button" onClick={toggle} aria-label={`Notifiche${count?`, ${count} nuove`:""}`} aria-expanded={open} className={`relative flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-2xl border border-pink-300/30 bg-[#160c18]/55 text-xl text-white shadow-[0_10px_32px_rgba(236,72,153,.18)] backdrop-blur-md transition-[opacity,transform,border-color,background-color] hover:scale-105 hover:border-pink-300/70 hover:bg-[#160c18]/85 hover:opacity-100 focus-visible:opacity-100 ${open||count>0?"opacity-100":"opacity-55"}`}>🔔{count>0&&<span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#070508] bg-pink-500 px-1 text-[10px] font-black text-white">{count>99?"99+":count}</span>}</button>{open&&<><button aria-label="Chiudi notifiche" onClick={closeAndRead} className="fixed inset-0 -z-10 bg-black/35 backdrop-blur-[2px]"/><section className="absolute right-0 mt-3 w-[min(92vw,390px)] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#100a12]/95 shadow-2xl backdrop-blur-2xl"><header className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-pink-300">Centro notifiche</p><h2 className="mt-1 text-xl font-black">Le tue novità</h2></div><button onClick={closeAndRead} className="h-9 w-9 rounded-full bg-white/[.06] text-xl">×</button></header>{permission!=="granted"&&<button onClick={()=>void enable()} className="m-4 w-[calc(100%-2rem)] rounded-xl border border-pink-300/25 bg-pink-500/10 px-4 py-3 text-xs font-black text-pink-200">ATTIVA NOTIFICHE DEL BROWSER</button>}<div className="max-h-[65vh] overflow-y-auto p-3">{grouped.length?grouped.map(item=><Link key={item.id} href={item.href} onClick={closeAndRead} className="flex gap-3 rounded-2xl p-3 transition hover:bg-white/[.06]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-xl">{icons[item.kind]}</span><span className="min-w-0"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block truncate text-xs text-white/45">{item.detail}</span></span></Link>):<div className="p-8 text-center"><p className="text-3xl">✓</p><p className="mt-3 font-black">Tutto sotto controllo</p><p className="mt-1 text-xs text-white/40">Non ci sono nuove notifiche.</p></div>}</div></section></>}</div>
}
