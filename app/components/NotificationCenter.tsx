"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import { supabase } from "@/lib/supabase"

type NoticeKind = "interest" | "match" | "message" | "mission" | "drink" | "table" | "reward"
type Notice = { id:string; kind:NoticeKind; title:string; detail:string; href:string }
type MatchRow = { id:string; user_one:string; user_two:string; created_at:string|null }

const appearance:Record<NoticeKind,{icon:string;label:string;classes:string}> = {
  interest: { icon:"✨", label:"Nuovo interesse", classes:"border-fuchsia-400/25 bg-fuchsia-500/15 text-fuchsia-100" },
  match: { icon:"♥", label:"Nuovo match", classes:"border-pink-400/25 bg-pink-500/15 text-pink-100" },
  message: { icon:"💬", label:"Messaggio", classes:"border-sky-400/25 bg-sky-500/15 text-sky-100" },
  mission: { icon:"✓", label:"Missione completata", classes:"border-green-400/25 bg-green-500/15 text-green-100" },
  drink: { icon:"🥂", label:"Offerta drink", classes:"border-orange-400/25 bg-orange-500/15 text-orange-100" },
  table: { icon:"🎲", label:"Tavolo", classes:"border-violet-400/25 bg-violet-500/15 text-violet-100" },
  reward: { icon:"🎁", label:"Premio", classes:"border-orange-400/25 bg-orange-500/15 text-orange-100" },
}

export default function NotificationCenter() {
  const { code:rawCode } = useParams<{code:string}>()
  const router = useRouter()
  const code = rawCode.trim().toLowerCase()
  const readKey = `zocyal_notifications_read_${code}`
  const [open,setOpen] = useState(false)
  const [notices,setNotices] = useState<Notice[]>([])
  const [toast,setToast] = useState<Notice|null>(null)
  const [permission,setPermission] = useState<NotificationPermission|"unsupported">("unsupported")
  const [permissionError,setPermissionError] = useState("")
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

      const [messagesResult,invitesResult,rewardsResult,interestsResult,missionsResult,serverReadsResult,drinkOffersResult] = await Promise.all([
        supabase.rpc("get_unread_notification_messages",{p_event_code:code}),
        supabase.from("game_table_invitations").select("id,table:game_tables(name,game)").eq("participant_id",participantId).eq("status","pending").order("invited_at",{ascending:false}),
        supabase.rpc("get_missions_rewards_for_event",{p_event_code:code}),
        supabase.from("likes").select("id,from_participant,to_participant").eq("to_participant",participantId),
        supabase.from("participant_mission_completions").select("id,points_awarded,mission:missions(title,event_code)").eq("participant_id",participantId).order("completed_at",{ascending:false}).limit(100),
        supabase.from("participant_notification_reads").select("notification_id").eq("participant_id",participantId),
        supabase.from("drink_offers").select("id,match_id,sender_id,status").eq("receiver_id",participantId).eq("status","pending").order("created_at",{ascending:false}),
      ])

      if (interestsResult.error) throw interestsResult.error
      if (missionsResult.error) throw missionsResult.error
      if (drinkOffersResult.error) throw drinkOffersResult.error

      const incomingInterests = (interestsResult.data || []) as Array<{id:string;from_participant:string;to_participant:string}>
      const matchedPeople = new Set(matches.map(match => match.user_one === participantId ? match.user_two : match.user_one))
      const pendingInterests = incomingInterests.filter(interest => !matchedPeople.has(interest.from_participant))
      const pendingDrinkOffers = (drinkOffersResult.data || []) as Array<{id:string;match_id:string;sender_id:string;status:string}>
      const senderIds = [...new Set([
        ...pendingInterests.map(interest => interest.from_participant),
        ...pendingDrinkOffers.map(offer => offer.sender_id),
      ])]
      const sendersResult = senderIds.length
        ? await supabase.from("participants").select("id,nickname").in("id",senderIds)
        : {data:[] as Array<{id:string;nickname:string|null}>,error:null}
      if (sendersResult.error) throw sendersResult.error
      const senderNames = new Map((sendersResult.data || []).map(sender => [sender.id,sender.nickname]))

      const seenAt = Number(localStorage.getItem(`zocyal_matches_seen_${code}`) || 0)
      const matchNotices:Notice[] = matches
        .filter(match => new Date(match.created_at || 0).getTime() > seenAt)
        .map(match => ({id:`match-${match.id}`,kind:"match",title:"È un match!",detail:"L’interesse è reciproco. Apri la nuova connessione.",href:`/evento/${code}/miei-match`}))
      const interestNotices:Notice[] = pendingInterests.map(interest => {
        const nickname = senderNames.get(interest.from_participant)
        return {id:`interest-${interest.id}`,kind:"interest",title:"Qualcuno è interessato a te",detail:nickname ? `${nickname} vorrebbe conoscerti.` : "Apri il profilo e scopri se l’interesse è reciproco.",href:`/evento/${code}/compatibilita?persona=${interest.from_participant}&mode=social`}
      })
      const messageNotices:Notice[] = ((messagesResult.data || []) as Array<{id:string;match_id:string;message:string|null}>).map(message => ({id:`message-${message.id}`,kind:"message",title:"Nuovo messaggio",detail:String(message.message || "Apri la chat per leggerlo."),href:`/evento/${code}/chat/${message.match_id}`}))
      const missionNotices:Notice[] = (missionsResult.data || []).flatMap(completion => {
        const mission = completion.mission as unknown as {title?:string;event_code?:string}|null
        if (mission?.event_code !== code) return []
        return [{id:`mission-${completion.id}`,kind:"mission" as const,title:"Missione completata!",detail:`${mission?.title || "Missione"} · +${completion.points_awarded} punti`,href:`/evento/${code}/missioni`}]
      })
      const drinkNotices:Notice[] = pendingDrinkOffers.map(offer => {
        const nickname = senderNames.get(offer.sender_id)
        return {id:`drink-${offer.id}`,kind:"drink",title:"Ti hanno offerto un drink",detail:nickname ? `${nickname} ti ha inviato una proposta. Rispondi ora.` : "Hai ricevuto una nuova proposta drink.",href:`/evento/${code}/chat/${offer.match_id}`}
      })
      const inviteNotices:Notice[] = (invitesResult.data || []).map(invite => { const table=invite.table as unknown as {name?:string;game?:string}|null; return {id:`table-${invite.id}`,kind:"table",title:"Invito al tavolo",detail:table?.name || table?.game || "Hai un nuovo invito.",href:`/evento/${code}/tavoli`} })
      const rewardNotices:Notice[] = ((rewardsResult.data as {rewards?:Array<{id:string;name:string;redeemed:boolean;redemption_status?:string}>}|null)?.rewards || []).filter(reward => reward.redeemed && reward.redemption_status === "redeemed").map(reward => ({id:`reward-${reward.id}`,kind:"reward",title:"Premio da ritirare",detail:reward.name || "Mostra il codice allo staff.",href:`/evento/${code}/missioni`}))
      const alreadyRead = readIds()
      if (!serverReadsResult.error) {
        ;(serverReadsResult.data || []).forEach(row => alreadyRead.add(row.notification_id))
      } else {
        console.warn("Ricevute notifiche non disponibili:",serverReadsResult.error)
      }
      const next = [...drinkNotices,...interestNotices,...messageNotices,...matchNotices,...missionNotices,...inviteNotices,...rewardNotices].filter(item => !alreadyRead.has(item.id))

      const fresh = initialized.current
        ? next.filter(item => !knownIds.current.has(item.id))
        : next
      if (fresh[0]) announce(fresh[0])
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
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"likes",filter:`to_participant=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"matches",filter:`user_one=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"matches",filter:`user_two=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`receiver_id=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"participant_mission_completions",filter:`participant_id=eq.${participantId}`},refresh)
        .on("postgres_changes",{event:"*",schema:"public",table:"drink_offers",filter:`receiver_id=eq.${participantId}`},refresh)
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
  async function enable() {
    setPermissionError("")
    if (!("Notification" in window)) {
      setPermission("unsupported")
      return
    }
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      localStorage.setItem("zocyal_chat_notifications",String(result === "granted"))
      if (result === "denied") setPermissionError("Il browser ha bloccato gli avvisi. Riattivali dalle impostazioni del sito.")
    } catch (error) {
      console.error("Attivazione notifiche non riuscita:",error)
      setPermissionError("Questo browser non consente di attivare gli avvisi da questa finestra.")
    }
  }
  async function persistRead(ids:string[]) {
    const read = readIds()
    ids.forEach(id => read.add(id))
    localStorage.setItem(readKey,JSON.stringify([...read].slice(-500)))
    if (ids.some(id => id.startsWith("match-"))) localStorage.setItem(`zocyal_matches_seen_${code}`,String(Date.now()))
    const participantId = participantIdRef.current
    if (!participantId || ids.length === 0) return
    const {error} = await supabase.from("participant_notification_reads").upsert(
      ids.map(notificationId => ({participant_id:participantId,notification_id:notificationId})),
      {onConflict:"participant_id,notification_id",ignoreDuplicates:true}
    )
    if (error) console.warn("Salvataggio lettura notifica non riuscito:",error)
  }
  async function openNotice(notice:Notice) {
    setNotices(current => current.filter(item => item.id !== notice.id))
    setToast(current => current?.id === notice.id ? null : current)
    setOpen(false)
    await persistRead([notice.id])
    router.push(notice.href)
  }
  async function markAllRead() {
    const ids = notices.map(item => item.id)
    setOpen(false)
    setNotices([])
    setToast(null)
    await persistRead(ids)
  }

  return <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] z-[70] sm:right-6 sm:top-5">
    {toast&&<button type="button" onClick={()=>void openNotice(toast)} className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[90] flex w-[min(92vw,430px)] -translate-x-1/2 items-center gap-4 overflow-hidden rounded-3xl border border-pink-300/30 bg-[#180d19]/95 p-4 text-left shadow-[0_24px_90px_rgba(236,72,153,.38)] backdrop-blur-2xl"><span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-fuchsia-500 via-pink-500 to-orange-400"/><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${appearance[toast.kind].classes}`}>{appearance[toast.kind].icon}</span><span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.18em] text-pink-300">{appearance[toast.kind].label}</span><strong className="mt-1 block text-base text-white">{toast.title}</strong><span className="mt-1 block truncate text-xs text-white/55">{toast.detail}</span></span><span className="text-xl text-white/35">›</span></button>}
    <button type="button" onClick={()=>setOpen(value=>!value)} aria-label={`Notifiche${notices.length?`, ${notices.length} nuove`:""}`} aria-expanded={open} className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border text-xl text-white shadow-[0_14px_42px_rgba(236,72,153,.22)] backdrop-blur-xl transition hover:scale-105 ${open||notices.length?"border-pink-300/60 bg-[#241020]":"border-white/15 bg-[#120b13]/75 opacity-75"}`}>🔔{notices.length>0&&<span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#070508] bg-gradient-to-r from-fuchsia-500 to-orange-400 px-1 text-[10px] font-black">{notices.length>99?"99+":notices.length}</span>}</button>
    {open&&<><button aria-label="Chiudi notifiche" onClick={()=>setOpen(false)} className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-[3px]"/><section className="absolute right-0 mt-3 w-[min(94vw,410px)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#100a12]/98 shadow-[0_30px_100px_rgba(0,0,0,.75)] backdrop-blur-2xl"><header className="border-b border-white/10 bg-gradient-to-br from-pink-500/15 via-transparent to-orange-400/[.06] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Centro notifiche</p><h2 className="mt-2 text-2xl font-black">Le tue novità</h2><p className="mt-1 text-xs text-white/40">{notices.length?`${notices.length} aggiornament${notices.length===1?"o":"i"} da vedere`:"Sei aggiornato su tutto"}</p></div><button onClick={()=>void markAllRead()} aria-label="Chiudi e segna tutte le notifiche come lette" title="Chiudi e segna tutte come lette" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-xl">×</button></div>{notices.length>0&&<button onClick={()=>void markAllRead()} className="mt-4 text-xs font-black text-pink-200 transition hover:text-white">SEGNA TUTTE COME LETTE</button>}</header>
      {permission==="default"&&<button onClick={()=>void enable()} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-between rounded-2xl border border-pink-300/20 bg-pink-500/[.08] px-4 py-3 text-left"><span><strong className="block text-xs text-pink-100">Avvisi anche fuori da Zocyal</strong><span className="mt-1 block text-[11px] text-white/40">Attiva le notifiche del browser</span></span><span className="text-lg text-pink-300">›</span></button>}
      {permission==="unsupported"&&<div className="mx-4 mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-4"><strong className="block text-xs text-amber-100">Avvisi di sistema non disponibili qui</strong><p className="mt-2 text-[11px] leading-5 text-white/50">Gli avvisi interni sono già attivi. Per riceverli anche fuori da Zocyal, apri il sito in Chrome o Edge.</p></div>}
      {permission==="denied"&&<div className="mx-4 mt-4 rounded-2xl border border-red-300/20 bg-red-400/[.07] p-4"><strong className="block text-xs text-red-100">Notifiche bloccate dal browser</strong><p className="mt-2 text-[11px] leading-5 text-white/50">Apri le impostazioni del sito dal lucchetto vicino all’indirizzo e imposta Notifiche su Consenti.</p></div>}
      {permission==="granted"&&<div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-green-300/20 bg-green-400/[.07] p-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-400/15 text-green-200">✓</span><span><strong className="block text-xs text-green-100">Avvisi di sistema attivi</strong><span className="mt-1 block text-[10px] text-white/40">Riceverai gli aggiornamenti anche fuori dalla pagina</span></span></div>}
      {permissionError&&<p className="mx-4 mt-3 rounded-xl border border-red-400/20 bg-red-400/[.07] p-3 text-xs leading-5 text-red-100">{permissionError}</p>}
      <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3">{grouped.length?grouped.map(item=>{const style=appearance[item.kind];return <button type="button" key={item.id} onClick={()=>void openNotice(item)} className="group flex w-full gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-white/10 hover:bg-white/[.05]"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl ${style.classes}`}>{style.icon}</span><span className="min-w-0 flex-1"><span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">{style.label}</span><strong className="mt-1 block text-sm text-white">{item.title}</strong><span className="mt-1 block truncate text-xs text-white/45">{item.detail}</span></span><span className="self-center text-xl text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60">›</span></button>}):<div className="p-10 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-green-400/20 bg-green-400/[.08] text-3xl text-green-300">✓</span><p className="mt-4 font-black">Tutto sotto controllo</p><p className="mt-2 text-xs leading-5 text-white/40">I nuovi match, messaggi, missioni, inviti e premi appariranno qui in tempo reale.</p></div>}</div>
    </section></>}
  </div>
}
