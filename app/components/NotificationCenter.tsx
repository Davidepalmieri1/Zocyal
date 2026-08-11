"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import { supabase } from "@/lib/supabase"

type NoticeKind = "match" | "message" | "table" | "reward"
type Notice = { id:string; kind:NoticeKind; title:string; detail:string; href:string }
type MatchRow = { id:string; user_one:string; user_two:string; created_at:string|null }

const appearance:Record<NoticeKind,{icon:string;label:string;classes:string}> = {
  match: { icon:"♥", label:"Nuovo match", classes:"border-pink-400/25 bg-pink-500/15 text-pink-100" },
  message: { icon:"💬", label:"Messaggio", classes:"border-sky-400/25 bg-sky-500/15 text-sky-100" },
  table: { icon:"🎲", label:"Tavolo", classes:"border-violet-400/25 bg-violet-500/15 text-violet-100" },
  reward: { icon:"🎁", label:"Premio", classes:"border-orange-400/25 bg-orange-500/15 text-orange-100" },
}

export default function NotificationCenter() {
  const { code:rawCode } = useParams<{code:string}>()
  const code = rawCode.trim().toLowerCase()
  const readKey = `zocyal_notifications_read_${code}`
  const [open,setOpen] = useState(false)
  const [notices,setNotices] = useState<Notice[]>([])
  const [toast,setToast] = useState<Notice|null>(null)
  const [permission,setPermission] = useState<NotificationPermission|"unsupported">("unsupported")
  const knownIds = useRef(new Set<string>())
  const initialized = useRef(false)
  const participantIdRef = useRef("")
  const matchIdsRef = useRef(new Set<string>())
  const loadingRef = useRef(false)

  const readIds = useCallback(() => {
    try { return new Set(JSON.parse(localStorage.getItem(readKey) || "[]") as string[]) }
    catch { return new Set<string>() }
  },[readKey])

  const announce = useCallback((notice:Notice) => {
    setToast(notice)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notice.title,{body:notice.detail})
    }
  },[])

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const participantId = participantIdRef.current || await resolveCurrentParticipant(code)
      if (!participantId) { setNotices([]); return }
      participantIdRef.current = participantId

      const matchesResult = await supabase.from("matches")
        .select("id,user_one,user_two,created_at")
        .or(`user_one.eq.${participantId},user_two.eq.${participantId}`)
        .neq("status","blocked")
        .order("created_at",{ascending:false})
      if (matchesResult.error) throw matchesResult.error
      const matches = (matchesResult.data || []) as MatchRow[]
      const matchIds = matches.map(match => match.id)
      matchIdsRef.current = new Set(matchIds)

      const [messagesResult,invitesResult,rewardsResult] = await Promise.all([
        supabase.rpc("get_unread_notification_messages",{p_event_code:code}),
        supabase.from("game_table_invitations").select("id,table:game_tables(name,game)").eq("participant_id",participantId).eq("status","pending").order("invited_at",{ascending:false}),
        supabase.rpc("get_missions_rewards_for_event",{p_event_code:code}),
      ])

      const seenAt = Number(localStorage.getItem(`zocyal_matches_seen_${code}`) || 0)
      const matchNotices:Notice[] = matches
        .filter(match => new Date(match.created_at || 0).getTime() > seenAt)
        .map(match => ({id:`match-${match.id}`,kind:"match",title:"È un match!",detail:"L’interesse è reciproco. Apri la nuova connessione.",href:`/evento/${code}/miei-match`}))
      const messageNotices:Notice[] = ((messagesResult.data || []) as Array<{id:string;match_id:string;message:string|null}>).map(message => ({id:`message-${message.id}`,kind:"message",title:"Nuovo messaggio",detail:String(message.message || "Apri la chat per leggerlo."),href:`/evento/${code}/chat/${message.match_id}`}))
      const inviteNotices:Notice[] = (invitesResult.data || []).map(invite => { const table=invite.table as unknown as {name?:string;game?:string}|null; return {id:`table-${invite.id}`,kind:"table",title:"Invito al tavolo",detail:table?.name || table?.game || "Hai un nuovo invito.",href:`/evento/${code}/tavoli`} })
      const rewardNotices:Notice[] = ((rewardsResult.data as {rewards?:Array<{id:string;name:string;redeemed:boolean;redemption_status?:string}>}|null)?.rewards || []).filter(reward => reward.redeemed && reward.redemption_status === "redeemed").map(reward => ({id:`reward-${reward.id}`,kind:"reward",title:"Premio da ritirare",detail:reward.name || "Mostra il codice allo staff.",href:`/evento/${code}/missioni`}))
      const alreadyRead = readIds()
      const next = [...messageNotices,...matchNotices,...inviteNotices,...rewardNotices].filter(item => !alreadyRead.has(item.id))

      if (initialized.current) {
        const fresh = next.filter(item => !knownIds.current.has(item.id))
        if (fresh[0]) announce(fresh[0])
      }
      knownIds.current = new Set(next.map(item => item.id))
      initialized.current = true
      setNotices(next)
    } finally {
      loadingRef.current = false
    }
  },[announce,code,readIds])

  useEffect(() => {
    let active = true
    let poll:number|null = null
    let refreshTimeout:number|null = null
    let channel:ReturnType<typeof supabase.channel>|null = null
    const refresh = () => {
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout)
      refreshTimeout = window.setTimeout(() => {
        refreshTimeout = null
        void load().catch(error => console.error("Sincronizzazione notifiche non riuscita:",error))
      },150)
    }
    const receiveLocal = (event:Event) => {
      const notice = (event as CustomEvent<Notice>).detail
      if (!notice?.id || readIds().has(notice.id)) return
      knownIds.current.add(notice.id)
      setNotices(current => current.some(item => item.id === notice.id) ? current : [notice,...current])
      announce(notice)
    }
    const start = async () => {
      setPermission("Notification" in window ? Notification.permission : "unsupported")
      try { await load() } catch(error) { console.error("Avvio notifiche non riuscito:",error) }
      const {data:{session}} = await supabase.auth.getSession()
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      const participantId = participantIdRef.current
      if (!participantId) return
      channel = supabase.channel(`participant-notifications-${participantId}`)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"matches",filter:`user_one=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"matches",filter:`user_two=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`receiver_id=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"*",schema:"public",table:"game_table_invitations",filter:`participant_id=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"*",schema:"public",table:"reward_redemptions",filter:`participant_id=eq.${participantId}`},refresh)
        .subscribe(status => { if(status === "SUBSCRIBED") refresh() })
      poll = window.setInterval(() => { if(!document.hidden) refresh() },30000)
    }
    void start()
    const {data:authListener} = supabase.auth.onAuthStateChange((_event,session) => { if(session?.access_token)supabase.realtime.setAuth(session.access_token); refresh() })
    const visible = () => { if(!document.hidden) refresh() }
    window.addEventListener("zocyal:notification",receiveLocal)
    document.addEventListener("visibilitychange",visible)
    window.addEventListener("focus",refresh)
    window.addEventListener("online",refresh)
    return () => {
      active=false
      if(refreshTimeout!==null)window.clearTimeout(refreshTimeout)
      if(poll!==null)window.clearInterval(poll)
      window.removeEventListener("zocyal:notification",receiveLocal)
      document.removeEventListener("visibilitychange",visible)
      window.removeEventListener("focus",refresh)
      window.removeEventListener("online",refresh)
      authListener.subscription.unsubscribe()
      if(channel)void supabase.removeChannel(channel)
    }
  },[announce,load,readIds])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null),6000)
    return () => window.clearTimeout(timer)
  },[toast])

  const grouped = useMemo(() => notices.slice(0,30),[notices])
  async function enable() { if(!("Notification" in window))return; const result=await Notification.requestPermission(); setPermission(result); localStorage.setItem("zocyal_chat_notifications",String(result==="granted")) }
  function markRead(id:string) { const read=readIds(); read.add(id); localStorage.setItem(readKey,JSON.stringify([...read].slice(-500))); if(id.startsWith("match-"))localStorage.setItem(`zocyal_matches_seen_${code}`,String(Date.now())); setNotices(current=>current.filter(item=>item.id!==id)); setOpen(false) }
  function markAllRead() { const read=readIds(); notices.forEach(item=>read.add(item.id)); localStorage.setItem(readKey,JSON.stringify([...read].slice(-500))); localStorage.setItem(`zocyal_matches_seen_${code}`,String(Date.now())); setNotices([]) }

  return <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] z-[70] sm:right-6 sm:top-5">
    {toast&&<Link href={toast.href} onClick={()=>markRead(toast.id)} className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[90] flex w-[min(92vw,430px)] -translate-x-1/2 items-center gap-4 overflow-hidden rounded-3xl border border-pink-300/30 bg-[#180d19]/95 p-4 shadow-[0_24px_90px_rgba(236,72,153,.38)] backdrop-blur-2xl"><span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-fuchsia-500 via-pink-500 to-orange-400"/><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${appearance[toast.kind].classes}`}>{appearance[toast.kind].icon}</span><span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.18em] text-pink-300">{appearance[toast.kind].label}</span><strong className="mt-1 block text-base text-white">{toast.title}</strong><span className="mt-1 block truncate text-xs text-white/55">{toast.detail}</span></span><span className="text-xl text-white/35">›</span></Link>}
    <button type="button" onClick={()=>setOpen(value=>!value)} aria-label={`Notifiche${notices.length?`, ${notices.length} nuove`:""}`} aria-expanded={open} className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border text-xl text-white shadow-[0_14px_42px_rgba(236,72,153,.22)] backdrop-blur-xl transition hover:scale-105 ${open||notices.length?"border-pink-300/60 bg-[#241020]":"border-white/15 bg-[#120b13]/75 opacity-75"}`}>🔔{notices.length>0&&<span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#070508] bg-gradient-to-r from-fuchsia-500 to-orange-400 px-1 text-[10px] font-black">{notices.length>99?"99+":notices.length}</span>}</button>
    {open&&<><button aria-label="Chiudi notifiche" onClick={()=>setOpen(false)} className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-[3px]"/><section className="absolute right-0 mt-3 w-[min(94vw,410px)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#100a12]/98 shadow-[0_30px_100px_rgba(0,0,0,.75)] backdrop-blur-2xl"><header className="border-b border-white/10 bg-gradient-to-br from-pink-500/15 via-transparent to-orange-400/[.06] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Centro notifiche</p><h2 className="mt-2 text-2xl font-black">Le tue novità</h2><p className="mt-1 text-xs text-white/40">{notices.length?`${notices.length} aggiornament${notices.length===1?"o":"i"} da vedere`:"Sei aggiornato su tutto"}</p></div><button onClick={()=>setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-xl">×</button></div>{notices.length>0&&<button onClick={markAllRead} className="mt-4 text-xs font-black text-pink-200 transition hover:text-white">SEGNA TUTTE COME LETTE</button>}</header>
      {permission!=="granted"&&<button onClick={()=>void enable()} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-between rounded-2xl border border-pink-300/20 bg-pink-500/[.08] px-4 py-3 text-left"><span><strong className="block text-xs text-pink-100">Avvisi anche fuori da Zocyal</strong><span className="mt-1 block text-[11px] text-white/40">Attiva le notifiche del browser</span></span><span className="text-lg text-pink-300">›</span></button>}
      <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3">{grouped.length?grouped.map(item=>{const style=appearance[item.kind];return <Link key={item.id} href={item.href} onClick={()=>markRead(item.id)} className="group flex gap-3 rounded-2xl border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[.05]"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl ${style.classes}`}>{style.icon}</span><span className="min-w-0 flex-1"><span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">{style.label}</span><strong className="mt-1 block text-sm text-white">{item.title}</strong><span className="mt-1 block truncate text-xs text-white/45">{item.detail}</span></span><span className="self-center text-xl text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60">›</span></Link>}):<div className="p-10 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-green-400/20 bg-green-400/[.08] text-3xl text-green-300">✓</span><p className="mt-4 font-black">Tutto sotto controllo</p><p className="mt-2 text-xs leading-5 text-white/40">I nuovi match, messaggi, inviti e premi appariranno qui in tempo reale.</p></div>}</div>
    </section></>}
  </div>
}
