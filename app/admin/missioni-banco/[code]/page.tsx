"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { fetchAdminData } from "@/app/admin/data-client"

type Mission = { id: string; title: string; description: string; points: number; verification_mode: "automatic" | "manual"; active: boolean }
type Person = { id: string; nickname: string | null; event_code: string }
type Completion = { mission_id: string; participant_id: string }
type ValidationRequest = { id:string; participant_id:string; mission_id:string; status:string; requested_at:string; participant:{nickname:string|null}|null; mission:{title:string;points:number}|null }
type Data = { missions: Mission[]; participants: Person[]; completions: Completion[]; validationRequests:ValidationRequest[] }

async function showStaffNotification(title:string, body:string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, { body })
        return
      }
    }

    new Notification(title, { body })
  } catch (error) {
    console.warn("Notifica browser non disponibile:", error)
  }
}

export default function MissioniBancoPage() {
  const { code: raw } = useParams<{ code: string }>()
  const code = raw.toLowerCase()
  const [data, setData] = useState<Data | null>(null)
  const [query, setQuery] = useState("")
  const [person, setPerson] = useState<Person | null>(null)
  const [mission, setMission] = useState<Mission | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const knownRequests = useRef(new Set<string>())
  const initialized = useRef(false)

  const load = useCallback(async () => {
    const next = await fetchAdminData<Data>("rewards", code)
    const requests = next.validationRequests || []
    setData(next)
    if (initialized.current) {
      const fresh = requests.filter(item => !knownRequests.current.has(item.id))
      if (fresh[0]) {
        void showStaffNotification(
          "Missione da convalidare",
          `${fresh[0].participant?.nickname || "Un partecipante"} · ${fresh[0].mission?.title || "Missione manuale"}`
        )
      }
    }
    knownRequests.current = new Set(requests.map(item => item.id))
    initialized.current = true
  }, [code])
  useEffect(() => {
    setData(null)
    setPerson(null)
    setMission(null)
    setQuery("")
    const refresh = () => void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Caricamento non riuscito."))
    const initial = window.setTimeout(refresh,0)
    const timer = window.setInterval(() => { if(!document.hidden) refresh() },3000)
    const visible = () => { if(!document.hidden) refresh() }
    document.addEventListener("visibilitychange",visible)
    window.addEventListener("focus",refresh)
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange",visible); window.removeEventListener("focus",refresh) }
  }, [load])

  const people = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("it")
    return (data?.participants || []).filter((item) => item.event_code === code && (!term || (item.nickname || "").toLocaleLowerCase("it").includes(term))).slice(0, 30)
  }, [code, data, query])

  const available = useMemo(() => {
    if (!person || !data) return []
    const completed = new Set(data.completions.filter((item) => item.participant_id === person.id).map((item) => item.mission_id))
    return data.missions.filter((item) => item.active && item.verification_mode === "manual" && !completed.has(item.id))
  }, [data, person])

  function reset() {
    setQuery("")
    setPerson(null)
    setMission(null)
    setSuccess("")
    setError("")
  }

  async function approve() {
    if (!person || !mission || busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/admin/api/rewards", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_manual", event_code: code, participant_id: person.id, mission_id: mission.id, note: "Assegnato dalla modalita Punti staff" }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Assegnazione non riuscita.")
      setSuccess(`${mission.points} punti assegnati a ${person.nickname || "partecipante"}.`)
      setMission(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assegnazione non riuscita.")
    } finally {
      setBusy(false)
    }
  }

  return <main className="premium-page min-h-screen px-4 py-5 text-white sm:px-6"><PremiumBackdrop /><div className="relative mx-auto w-full max-w-lg">
    <header className="flex items-center justify-between gap-4"><div><p className="premium-eyebrow">Modalit&agrave; staff</p><h1 className="mt-2 text-3xl font-black">Assegna punti</h1><p className="mt-2 text-xs font-black uppercase tracking-[.14em] text-white/40">Evento: {code}</p></div><Link href={`/admin/premi/${code}`} className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black text-white/65">GESTIONE</Link></header>
    {error && <p role="alert" className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    {!person && !success && Boolean(data?.validationRequests?.length) && <section className="mt-6 rounded-[2rem] border border-pink-400/30 bg-gradient-to-br from-pink-500/15 to-orange-400/[.08] p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-pink-300">Richieste in tempo reale</p><h2 className="mt-2 text-2xl font-black">Da convalidare</h2></div><span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-pink-500 px-3 font-black">{data?.validationRequests.length}</span></div><div className="mt-4 grid gap-3">{data?.validationRequests.map(request=><button key={request.id} onClick={()=>{const selectedPerson=data.participants.find(item=>item.id===request.participant_id);const selectedMission=data.missions.find(item=>item.id===request.mission_id);if(selectedPerson&&selectedMission){setPerson(selectedPerson);setMission(selectedMission)}}} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-pink-300/40 hover:bg-pink-500/10"><span><strong className="block">{request.participant?.nickname || "Partecipante"}</strong><span className="mt-1 block text-sm text-white/50">{request.mission?.title || "Missione"}</span></span><span className="shrink-0 font-black text-orange-300">+{request.mission?.points || 0} ›</span></button>)}</div></section>}
    {success ? <section className="mt-6 rounded-[2rem] border border-emerald-400/30 bg-emerald-400/10 p-7 text-center"><p className="text-5xl">{"\u2713"}</p><h2 className="mt-3 text-2xl font-black">Punti assegnati</h2><p className="mt-2 text-emerald-100/70">{success}</p><button onClick={reset} className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-black">ASSEGNA AL PROSSIMO</button></section>
      : !person ? <section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7"><div className="text-center"><span className="text-5xl">{"\u{1F464}"}</span><h2 className="mt-4 text-2xl font-black">Chi ha completato la missione?</h2><p className="mt-2 text-sm text-white/45">Cerca il partecipante per nome.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Scrivi il nome..." className="mt-6 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg font-bold outline-none focus:border-orange-300/50" /><div className="mt-4 grid gap-2">{people.map((item) => <button key={item.id} onClick={() => { setPerson(item); setQuery("") }} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left font-black hover:border-orange-300/40 hover:bg-orange-300/10"><span>{item.nickname || "Partecipante"}</span><span className="text-2xl text-white/30">{"\u203A"}</span></button>)}</div></section>
      : !mission ? <section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7"><button onClick={() => setPerson(null)} className="text-xs font-black text-white/45">{"\u2039"} CAMBIA PERSONA</button><p className="mt-5 text-xs font-black uppercase tracking-wider text-orange-300">Partecipante</p><h2 className="mt-1 text-3xl font-black">{person.nickname || "Partecipante"}</h2><p className="mt-5 text-sm text-white/45">Seleziona la missione completata.</p><div className="mt-4 grid gap-3">{available.map((item) => <button key={item.id} onClick={() => setMission(item)} className="rounded-2xl border border-orange-300/20 bg-orange-300/[.07] p-5 text-left hover:bg-orange-300/15"><div className="flex justify-between gap-4"><div><h3 className="font-black">{item.title}</h3><p className="mt-1 text-sm text-white/40">{item.description}</p></div><span className="shrink-0 text-xl font-black text-orange-300">+{item.points}</span></div></button>)}{!available.length && <p className="rounded-2xl border border-dashed border-white/15 p-7 text-center text-white/40">Nessuna missione manuale ancora da assegnare a questa persona.</p>}</div></section>
      : <section className="mt-6 rounded-[2rem] border border-orange-300/25 bg-orange-300/[.08] p-6 text-center"><p className="text-xs font-black uppercase tracking-wider text-orange-300">Conferma assegnazione</p><h2 className="mt-3 text-2xl font-black">{mission.title}</h2><p className="mt-2 text-white/50">a {person.nickname || "Partecipante"}</p><p className="mt-6 text-6xl font-black text-orange-300">+{mission.points}</p><p className="mt-1 text-sm font-bold text-orange-100/60">punti</p><button disabled={busy} onClick={() => void approve()} className="mt-6 w-full rounded-2xl bg-orange-400 px-5 py-4 text-sm font-black text-black disabled:opacity-50">{busy ? "ASSEGNO..." : "CONFERMA E ASSEGNA PUNTI"}</button><button disabled={busy} onClick={() => setMission(null)} className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-4 text-sm font-black">INDIETRO</button></section>}
  </div></main>
}
