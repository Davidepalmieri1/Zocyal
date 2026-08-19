"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { EmptyState, LiveSyncStatus } from "@/app/components/EventUi"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import { publicSupabase, supabase } from "@/lib/supabase"

type Profile = { id:string; nickname:string|null; avatar_url:string|null }
type MatchRow = { id:string; user_one:string; user_two:string; status:string|null; created_at:string|null }
type MatchPerson = { id:string; nickname:string|null; avatar_url:string|null; matchId:string }
type RewardRow = { id:string; name:string; redeemed:boolean; redemption_status?:string|null; claim_code?:string|null }
type DrinkCouponRow = { id:string; coupon_code:string; offer?:{status?:string;match_id?:string}|null }
type Coupon = { id:string; code:string; label:string; status:string; href:string }

const modeLabels:Record<string,string> = {
  standard:"Modalità standard",
  inclusive:"Modalità inclusiva",
  caribbean:"Modalità caraibica",
}

export default function ParticipantHomePage() {
  const {code:rawCode} = useParams<{code:string}>()
  const router = useRouter()
  const code = rawCode.trim().toLowerCase()
  const [profile,setProfile] = useState<Profile|null>(null)
  const [mode,setMode] = useState("standard")
  const [eventName,setEventName] = useState("La tua serata")
  const [matches,setMatches] = useState<MatchPerson[]>([])
  const [coupons,setCoupons] = useState<Coupon[]>([])
  const [points,setPoints] = useState(0)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState("")
  const [updatedAt,setUpdatedAt] = useState<Date|null>(null)

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true)
    setError("")
    try {
      const participantId = await resolveCurrentParticipant(code)
      if (!participantId) {
        router.replace(`/evento/${code}`)
        return
      }

      const [profileResult,eventResult,matchesResult,rewardsResult,drinkCouponsResult] = await Promise.all([
        supabase.from("participants").select("id,nickname,avatar_url").eq("id",participantId).maybeSingle(),
        publicSupabase.from("events").select("name,experience_mode").eq("code",code).maybeSingle(),
        supabase.from("matches").select("id,user_one,user_two,status,created_at").or(`user_one.eq.${participantId},user_two.eq.${participantId}`).neq("status","blocked").order("created_at",{ascending:false}),
        supabase.rpc("get_missions_rewards_for_event",{p_event_code:code}),
        supabase.from("drink_coupons").select("id,coupon_code,offer:drink_offers(status,match_id)").eq("owner_id",participantId).order("created_at",{ascending:false}),
      ])

      if (profileResult.error) throw profileResult.error
      if (!profileResult.data) {
        router.replace(`/evento/${code}`)
        return
      }

      const matchRows = (matchesResult.data || []) as MatchRow[]
      const otherIds = [...new Set(matchRows.map(match => match.user_one === participantId ? match.user_two : match.user_one))]
      const peopleResult = otherIds.length
        ? await supabase.from("participants").select("id,nickname,avatar_url").in("id",otherIds)
        : {data:[] as Array<{id:string;nickname:string|null;avatar_url:string|null}>,error:null}
      if (peopleResult.error) throw peopleResult.error
      const people = new Map((peopleResult.data || []).map(person => [person.id,person]))

      const rewardDashboard = (rewardsResult.data || {}) as {points_available?:number;rewards?:RewardRow[]}
      const rewardCoupons:Coupon[] = (rewardDashboard.rewards || [])
        .filter(reward => reward.redeemed && reward.claim_code)
        .map(reward => ({
          id:`reward-${reward.id}`,
          code:reward.claim_code || "",
          label:reward.name || "Premio Zocyal",
          status:reward.redemption_status === "fulfilled" ? "Utilizzato" : "Da ritirare",
          href:`/evento/${code}/missioni`,
        }))
      const drinkCoupons:Coupon[] = ((drinkCouponsResult.data || []) as unknown as DrinkCouponRow[]).map(coupon => ({
        id:`drink-${coupon.id}`,
        code:coupon.coupon_code,
        label:"Coupon drink",
        status:coupon.offer?.status === "redeemed" ? "Utilizzato" : "Disponibile",
        href:coupon.offer?.match_id ? `/evento/${code}/chat/${coupon.offer.match_id}` : `/evento/${code}/miei-match`,
      }))

      setProfile(profileResult.data as Profile)
      setMode(eventResult.data?.experience_mode || "standard")
      setEventName(eventResult.data?.name || "La tua serata")
      setPoints(Number(rewardDashboard.points_available || 0))
      setMatches(matchRows.flatMap(match => {
        const otherId = match.user_one === participantId ? match.user_two : match.user_one
        const person = people.get(otherId)
        return person ? [{...person,matchId:match.id}] : []
      }))
      setCoupons([...rewardCoupons,...drinkCoupons])
      setUpdatedAt(new Date())
    } catch(cause) {
      console.error("Errore home partecipante:",cause)
      setError("Non siamo riusciti ad aggiornare la tua home. Riprova tra qualche secondo.")
    } finally {
      setLoading(false)
    }
  },[code,router])

  useEffect(() => {
    let active=true
    const initial=window.setTimeout(()=>void load(),0)
    const refresh=()=>{if(active&&!document.hidden)void load(true)}
    const timer=window.setInterval(refresh,30000)
    document.addEventListener("visibilitychange",refresh)
    window.addEventListener("focus",refresh)
    window.addEventListener("zocyal:notification-count",refresh)
    return()=>{
      active=false
      window.clearTimeout(initial)
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange",refresh)
      window.removeEventListener("focus",refresh)
      window.removeEventListener("zocyal:notification-count",refresh)
    }
  },[load])

  const actions = useMemo(() => [
    ...(mode === "caribbean" ? [{icon:"💃",title:"Entra in pista",detail:"Profilo, ballerini e inviti live",href:`/evento/${code}/balla`}] : [{icon:"🎲",title:"Tavoli gioco",detail:"Inviti e posti disponibili",href:`/evento/${code}/tavoli`}]),
    {icon:"✨",title:"Scopri affinità",detail:"Trova il tuo prossimo match",href:`/evento/${code}/compatibilita`},
    {icon:"🤝",title:"Conosci persone",detail:"Esplora la community della serata",href:`/evento/${code}/social`},
    {icon:"💬",title:"Match e chat",detail:`${matches.length} ${matches.length === 1 ? "connessione" : "connessioni"}`,href:`/evento/${code}/miei-match`},
    {icon:"🎯",title:"Missioni e premi",detail:`${points} punti disponibili`,href:`/evento/${code}/missioni`},
    {icon:"👤",title:"Il mio profilo",detail:"Foto, nome e preferenze",href:`/evento/${code}/mio-profilo`},
  ],[code,matches.length,mode,points])

  if (loading) return <main className="premium-page flex min-h-screen items-center justify-center px-6 text-white"><PremiumBackdrop/><div className="relative text-center"><Logo size="medium"/><div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500"/><p className="mt-5 text-white/45">Prepariamo la tua home…</p></div></main>

  return <main className="premium-page min-h-screen px-4 pb-28 pt-7 text-white sm:px-6 sm:pt-10">
    <PremiumBackdrop/>
    <div className="relative mx-auto w-full max-w-6xl">
      <div className="flex items-center justify-between gap-4"><Logo size="small"/><span className="rounded-full border border-pink-300/20 bg-pink-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-pink-200">{modeLabels[mode] || modeLabels.standard}</span></div>

      <section className="premium-glass premium-enter mt-7 overflow-hidden rounded-[2.25rem]">
        <div className="relative bg-gradient-to-br from-fuchsia-500/20 via-pink-500/10 to-orange-400/15 p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <Link href={`/evento/${code}/mio-profilo`} aria-label="Apri il mio profilo" className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/20 bg-black/40 shadow-2xl">
              {profile?.avatar_url ? <Image src={profile.avatar_url} alt={profile.nickname || "Foto profilo"} width={160} height={160} sizes="96px" className="h-full w-full object-cover"/> : <span className="text-5xl">👤</span>}
            </Link>
            <div className="min-w-0"><p className="premium-eyebrow">{eventName}</p><h1 className="premium-title mt-2 truncate text-4xl font-black sm:text-5xl">Ciao, {profile?.nickname || "Partecipante"}.</h1><p className="mt-2 text-sm text-white/50">Questa è la tua serata, tutta in un posto.</p></div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Link href={`/evento/${code}/miei-match`} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center transition hover:border-pink-300/35"><strong className="block text-2xl text-pink-200">{matches.length}</strong><span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-white/40">Match</span></Link>
            <Link href={`/evento/${code}/missioni`} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center transition hover:border-orange-300/35"><strong className="block text-2xl text-orange-200">{coupons.length}</strong><span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-white/40">Coupon</span></Link>
            <Link href={`/evento/${code}/missioni`} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center transition hover:border-emerald-300/35"><strong className="block text-2xl text-emerald-200">{points}</strong><span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-white/40">Punti</span></Link>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-300/25 bg-red-400/10 p-4 text-sm text-red-100">{error}</p>}

      <section className="mt-8"><div className="flex items-end justify-between gap-4"><div><p className="premium-eyebrow">Attività</p><h2 className="mt-2 text-3xl font-black">Cosa vuoi fare?</h2></div><LiveSyncStatus updatedAt={updatedAt} label="Home aggiornata"/></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{actions.map(action=><Link key={action.href} href={action.href} className="premium-card-lift group rounded-3xl border border-white/10 bg-white/[.04] p-5 transition hover:border-pink-300/35 hover:bg-white/[.07]"><div className="flex items-start gap-4"><span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/[.06] text-2xl">{action.icon}</span><div className="min-w-0 flex-1"><h3 className="text-lg font-black group-hover:text-pink-200">{action.title}</h3><p className="mt-2 text-sm leading-6 text-white/40">{action.detail}</p></div><span className="text-2xl text-white/25 group-hover:text-pink-200">›</span></div></Link>)}</div>
      </section>

      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        <section className="premium-glass rounded-[2rem] p-6"><div className="flex items-center justify-between"><div><p className="premium-eyebrow">Connessioni</p><h2 className="mt-2 text-2xl font-black">I tuoi match</h2></div><Link href={`/evento/${code}/miei-match`} className="text-sm font-black text-pink-200">VEDI TUTTI →</Link></div>
          {matches.length ? <div className="mt-5 space-y-3">{matches.slice(0,4).map(match=><Link key={match.matchId} href={`/evento/${code}/chat/${match.matchId}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-pink-300/30"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[.06]">{match.avatar_url ? <Image src={match.avatar_url} alt={match.nickname || "Match"} width={72} height={72} className="h-full w-full object-cover"/> : "👤"}</span><span className="min-w-0 flex-1 truncate font-black">{match.nickname || "Partecipante"}</span><span className="text-xl text-white/30">›</span></Link>)}</div> : <EmptyState icon="♥" title="Nessun match ancora" description="Le nuove connessioni compariranno qui." className="mt-5"/>}
        </section>

        <section className="premium-glass rounded-[2rem] p-6"><div className="flex items-center justify-between"><div><p className="premium-eyebrow">Premi</p><h2 className="mt-2 text-2xl font-black">I tuoi coupon</h2></div><Link href={`/evento/${code}/missioni`} className="text-sm font-black text-orange-200">APRI PREMI →</Link></div>
          {coupons.length ? <div className="mt-5 space-y-3">{coupons.slice(0,4).map(coupon=><Link key={coupon.id} href={coupon.href} className="block rounded-2xl border border-orange-300/20 bg-orange-300/[.07] p-4 transition hover:border-orange-200/40"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{coupon.label}</p><p className="mt-2 font-mono text-lg font-black tracking-[.14em] text-orange-200">{coupon.code}</p></div><span className="rounded-full bg-white/[.06] px-2.5 py-1 text-[9px] font-black uppercase text-white/45">{coupon.status}</span></div></Link>)}</div> : <EmptyState icon="🎁" title="Nessun coupon generato" description="Quando riscatti un premio o un’offerta drink, apparirà qui." className="mt-5"/>}
        </section>
      </div>
    </div>
  </main>
}
