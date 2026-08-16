"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
const LEVELS = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzato" } as const
const ROLE_LABELS = { leader: "Leader", follower: "Follower", both: "Leader · Follower" } as const
type Role = keyof typeof ROLE_LABELS
type Level = keyof typeof LEVELS
type Tab = "profile" | "dance"
type Dancer = { participant_id: string; role: Role; skills: Record<string, Level>; available: boolean; participant: { nickname: string; avatar_url: string | null } | null }
type Invite = { id: string; sender_id: string; receiver_id: string; style: string; status: string; created_at: string; sender: { nickname: string } | null; receiver: { nickname: string } | null }
type DanceLobby = { profiles: Dancer[]; invitations: Invite[]; completed_test: boolean }

export default function DancePage() {
  const { code: raw } = useParams<{ code: string }>()
  const code = raw.toLowerCase()
  const router = useRouter()
  const [mine, setMine] = useState("")
  const [role, setRole] = useState<Role>("both")
  const [skills, setSkills] = useState<Record<string, Level>>({})
  const [available, setAvailable] = useState(true)
  const [dancers, setDancers] = useState<Dancer[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [hasProfile, setHasProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [profileFeedback, setProfileFeedback] = useState("")
  const [matchProfileCompleted, setMatchProfileCompleted] = useState(false)
  const [showMatchPrompt, setShowMatchPrompt] = useState(false)
  const [liveNotice, setLiveNotice] = useState("")
  const initialized = useRef(false)
  const labels = useMemo(() => new Map<string, string>(STYLES), [])
  const pendingInvites = useMemo(() => invites.filter(invite => invite.receiver_id === mine && invite.status === "pending"), [invites, mine])
  const sentInvites = useMemo(() => invites.filter(invite => invite.sender_id === mine && invite.status !== "expired" && invite.status !== "cancelled").slice(0, 3), [invites, mine])

  const load = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc("get_dance_lobby", { p_event_code: code })
    if (error) throw error
    const lobby = (data || { profiles: [], invitations: [] }) as DanceLobby
    const profiles = lobby.profiles || []
    const own = profiles.find(item => item.participant_id === id)
    setMatchProfileCompleted(Boolean(lobby.completed_test))
    setHasProfile(Boolean(own))
    if (own) {
      setRole(own.role)
      setSkills(own.skills)
      setAvailable(own.available)
      if (!initialized.current) setActiveTab("dance")
    }
    initialized.current = true
    setDancers(profiles.filter(item => item.participant_id !== id))
    setInvites(lobby.invitations || [])
  }, [code])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const event = await publicSupabase.from("events").select("experience_mode").eq("code", code).maybeSingle()
        if (event.data?.experience_mode !== "caribbean") { router.replace(`/evento/${code}`); return }
        const id = await resolveCurrentParticipant(code)
        if (!id) throw new Error("Profilo partecipante non trovato.")
        if (!active) return
        setMine(id)
        await load(id)
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Impossibile aprire la pista.")
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [code, load, router])

  useEffect(() => {
    if (!mine) return
    let active = true
    let realtimeReady = false
    const refresh = () => { if (active) void load(mine).catch(() => undefined) }
    const incoming = (payload: { new: Record<string, unknown> }) => {
      const invite = payload.new
      if (invite.receiver_id === mine && invite.status === "pending") {
        setLiveNotice("Hai ricevuto un nuovo invito a ballare")
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Nuovo invito ZOCYAL", { body: "Qualcuno vuole ballare con te. Apri la Pista per rispondere." })
        }
      }
      refresh()
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token)
    })
    const channel = supabase.channel(`dance-lobby-${code}-${mine}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dance_invitations", filter: `receiver_id=eq.${mine}` }, incoming)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dance_invitations", filter: `receiver_id=eq.${mine}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dance_invitations", filter: `sender_id=eq.${mine}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participant_dance_profiles" }, refresh)
      .subscribe(status => { realtimeReady = status === "SUBSCRIBED"; if (realtimeReady) refresh() })
    // Realtime remains the primary path; this also covers mobile browsers that
    // silently pause or drop websocket events while the page stays open.
    const fallback = window.setInterval(() => { if (!document.hidden) refresh() }, realtimeReady ? 3000 : 2000)
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      active = false
      window.clearInterval(fallback)
      document.removeEventListener("visibilitychange", onVisible)
      void supabase.removeChannel(channel)
    }
  }, [code, load, mine])

  async function save() {
    if (!mine) { setProfileFeedback("Profilo partecipante non disponibile. Ricarica la pagina."); return }
    if (!Object.keys(skills).length) { setProfileFeedback("Seleziona almeno uno stile di ballo."); return }
    setBusy("profile"); setProfileFeedback("")
    try {
      const wasNew = !hasProfile
      const { error } = await supabase.rpc("save_dance_profile", { p_event_code: code, p_role: role, p_skills: skills, p_available: available })
      if (error) throw error
      setHasProfile(true)
      setProfileFeedback("Profilo aggiornato. Ora sei visibile nella pista.")
      await load(mine)
      setActiveTab("dance")
      if (wasNew && !matchProfileCompleted) setShowMatchPrompt(true)
    } catch (error) { setProfileFeedback(error instanceof Error ? error.message : "Salvataggio non riuscito. Riprova.") }
    finally { setBusy("") }
  }

  function toggle(style: string) {
    setSkills(current => { const next = { ...current }; if (next[style]) delete next[style]; else next[style] = "beginner"; return next })
  }

  async function invite(dancer: Dancer) {
    const shared = Object.keys(skills).filter(style => dancer.skills[style])
    if (!shared.length) { setMessage("Non avete ancora uno stile in comune."); return }
    setBusy(dancer.participant_id); setMessage("")
    const { error } = await supabase.rpc("send_dance_invitation", { p_event_code: code, p_receiver_id: dancer.participant_id, p_style: shared[0], p_message: null })
    if (error) setMessage(error.message.includes("Active invitation") ? "Hai già un invito attivo." : error.message)
    else { await load(mine); setMessage(`Invito inviato a ${dancer.participant?.nickname || "questo ballerino"} per ${labels.get(shared[0])}.`) }
    setBusy("")
  }

  async function respond(id: string, response: "accepted" | "declined") {
    setBusy(id); setMessage("")
    const { error } = await supabase.rpc("respond_dance_invitation", { p_invitation_id: id, p_response: response })
    if (error) {
      await load(mine).catch(() => undefined)
      setMessage(error.message.includes("Invitation unavailable") ? "Questo invito è scaduto o ha già ricevuto una risposta." : error.message)
    }
    else {
      await load(mine)
      setMessage(response === "accepted" ? "Invito accettato. Buon ballo!" : "Invito rifiutato.")
    }
    setBusy("")
  }

  function invitationIssue(dancer: Dancer) {
    if (!dancer.available) return "Non disponibile"
    if (!Object.keys(skills).some(style => dancer.skills[style])) return "Nessuno stile in comune"
    if (!(role === "both" || dancer.role === "both" || role !== dancer.role)) return "Ruoli non compatibili"
    return ""
  }

  return <main className="premium-page px-4 pb-28 pt-7 sm:px-6">
    <PremiumBackdrop />
    <div className="relative mx-auto max-w-6xl">
      <Logo size="small" />
      <header className="premium-enter mt-9 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><p className="premium-eyebrow">Modalità caraibica</p><h1 className="premium-title premium-gradient-text mt-3 text-4xl font-black sm:text-6xl">La tua pista, il tuo ritmo.</h1><p className="mt-4 max-w-2xl text-white/50">Cura il tuo profilo oppure entra in pista per scoprire chi vuole ballare.</p></div>
        {hasProfile && <div className={`flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wider ${available ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/[.04] text-white/45"}`}><span className={`h-2 w-2 rounded-full ${available ? "animate-pulse bg-emerald-300" : "bg-white/30"}`} />{available ? "Disponibile" : "In pausa"}</div>}
      </header>

      <nav aria-label="Sezioni modalità ballo" className="premium-glass premium-enter premium-enter-delay-1 sticky top-4 z-40 mt-8 grid grid-cols-2 rounded-2xl p-1.5">
        <button type="button" onClick={() => setActiveTab("profile")} aria-current={activeTab === "profile" ? "page" : undefined} className={`flex min-h-14 items-center justify-center gap-3 rounded-xl px-4 text-sm font-black transition ${activeTab === "profile" ? "bg-white text-black shadow-xl" : "text-white/50 hover:text-white"}`}><span className="text-lg">✦</span><span>IL MIO PROFILO</span></button>
        <button type="button" onClick={() => { setActiveTab("dance"); setLiveNotice("") }} aria-current={activeTab === "dance" ? "page" : undefined} className={`relative flex min-h-14 items-center justify-center gap-3 rounded-xl px-4 text-sm font-black transition ${activeTab === "dance" ? "bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-xl shadow-pink-950/30" : "text-white/50 hover:text-white"}`}><span className="text-lg">♫</span><span>PISTA</span>{pendingInvites.length > 0 && <span className="flex min-w-6 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-xs text-pink-600">{pendingInvites.length}</span>}</button>
      </nav>

      {liveNotice && <button type="button" onClick={() => { setActiveTab("dance"); setLiveNotice("") }} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-pink-300/30 bg-pink-400/15 p-4 text-left shadow-lg shadow-pink-950/20"><span><strong className="block text-pink-100">{liveNotice}</strong><span className="text-sm text-white/55">Tocca per rispondere adesso</span></span><span className="text-xl">→</span></button>}
      {message && <p role="status" className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-300/10 p-4 text-orange-100">{message}</p>}

      {activeTab === "profile" && <section className="premium-glass premium-enter mt-6 overflow-hidden rounded-[2rem]">
        <div className="border-b border-white/10 bg-gradient-to-br from-pink-400/15 via-transparent to-orange-300/10 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><span className="inline-flex rounded-full bg-pink-300/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-pink-200">Identità in pista</span><h2 className="mt-3 text-3xl font-black">Il mio profilo di ballo</h2><p className="mt-2 text-sm text-white/50">Scegli come balli e quando vuoi essere invitato.</p></div>
          <label className={`flex cursor-pointer items-center justify-between gap-5 rounded-2xl border p-4 transition ${available ? "border-emerald-300/25 bg-emerald-300/10" : "border-white/10 bg-black/20"}`}><span><strong className="block text-sm">Disponibile a ballare</strong><span className="text-xs text-white/45">Compari tra i ballerini invitabili</span></span><input type="checkbox" checked={available} onChange={event => setAvailable(event.target.checked)} className="h-5 w-5 accent-emerald-400" /></label></div>
        </div>
        <div className="p-6 sm:p-8"><div><p className="text-xs font-black uppercase tracking-[.18em] text-white/40">1 · Il tuo ruolo</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{(["leader", "follower", "both"] as Role[]).map(value => <button type="button" key={value} onClick={() => setRole(value)} className={`rounded-2xl border p-4 text-left transition ${role === value ? "border-orange-300/50 bg-orange-300/10 text-orange-100 shadow-lg shadow-orange-950/20" : "border-white/10 bg-white/[.025] text-white/45 hover:border-white/20"}`}><span className="block text-lg font-black">{ROLE_LABELS[value]}</span><span className="mt-1 block text-xs font-normal opacity-65">{value === "both" ? "Mi adatto al partner" : `Preferisco ballare come ${ROLE_LABELS[value]}`}</span></button>)}</div></div>
          <div className="mt-8"><p className="text-xs font-black uppercase tracking-[.18em] text-white/40">2 · Stili e livello</p><p className="mt-2 text-sm text-white/45">Seleziona tutto quello che ti va di ballare stasera.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STYLES.map(([value, label]) => <div key={value} className={`rounded-2xl border p-4 transition ${skills[value] ? "border-pink-300/35 bg-pink-400/[.09] shadow-lg shadow-pink-950/15" : "border-white/10 bg-white/[.02]"}`}><label className="flex cursor-pointer items-center gap-3 font-black"><input type="checkbox" checked={Boolean(skills[value])} onChange={() => toggle(value)} className="h-5 w-5 accent-pink-500" />{label}</label>{skills[value] && <select aria-label={`Livello ${label}`} value={skills[value]} onChange={event => setSkills(current => ({ ...current, [value]: event.target.value as Level }))} className="mt-3 w-full rounded-xl border-0 bg-white p-2.5 text-sm font-bold text-black">{Object.entries(LEVELS).map(([level, text]) => <option key={level} value={level}>{text}</option>)}</select>}</div>)}</div></div>
          <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center"><p role="status" className={`text-sm ${profileFeedback ? "text-orange-100" : "text-white/35"}`}>{profileFeedback || "Puoi modificare il profilo in qualsiasi momento."}</p><button type="button" disabled={busy === "profile" || !mine} onClick={() => void save()} className="premium-cta rounded-full bg-gradient-to-r from-pink-500 to-orange-400 px-7 py-3.5 font-black disabled:cursor-wait disabled:opacity-60">{busy === "profile" ? "SALVATAGGIO…" : hasProfile ? "SALVA MODIFICHE" : "CREA IL PROFILO"}</button></div>
        </div>
      </section>}

      {activeTab === "dance" && <section className="premium-enter mt-6 space-y-7">
        {!hasProfile && <div className="premium-glass rounded-[2rem] p-8 text-center"><span className="text-4xl">✦</span><h2 className="mt-3 text-2xl font-black">Prima crea il tuo profilo</h2><p className="mt-2 text-white/50">Bastano ruolo e uno stile per entrare in pista.</p><button type="button" onClick={() => setActiveTab("profile")} className="premium-cta mt-5 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 px-6 py-3 font-black">CREA PROFILO</button></div>}
        {hasProfile && <>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="premium-glass rounded-[2rem] p-6 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="premium-eyebrow">Richieste in arrivo</p><h2 className="mt-2 text-2xl font-black">Inviti ricevuti</h2></div>{pendingInvites.length > 0 && <span className="rounded-full bg-pink-500 px-3 py-1 text-xs font-black">{pendingInvites.length} NUOV{pendingInvites.length === 1 ? "O" : "I"}</span>}</div>
              <div className="mt-5 space-y-3">{pendingInvites.map(invite => <article key={invite.id} className="rounded-2xl border border-orange-300/25 bg-gradient-to-br from-orange-300/10 to-pink-400/[.07] p-5"><div className="flex items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-300/15 text-2xl">♫</span><div><p className="text-xs font-black uppercase tracking-wider text-orange-200">{labels.get(invite.style)}</p><h3 className="mt-1 text-lg font-black">{invite.sender?.nickname || "Qualcuno"} ti invita a ballare</h3></div></div><div className="mt-5 grid grid-cols-2 gap-2"><button disabled={busy === invite.id} onClick={() => void respond(invite.id, "accepted")} className="premium-cta rounded-full bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-3 font-black disabled:opacity-50">ACCETTA</button><button disabled={busy === invite.id} onClick={() => void respond(invite.id, "declined")} className="rounded-full border border-white/15 px-4 py-3 font-black text-white/65 disabled:opacity-50">RIFIUTA</button></div></article>)}{!pendingInvites.length && <div className="rounded-2xl border border-dashed border-white/15 p-7 text-center"><span className="text-3xl opacity-50">♫</span><p className="mt-2 font-bold text-white/50">Nessun invito in attesa</p><p className="mt-1 text-xs text-white/30">Quando arriva, lo vedrai qui in tempo reale.</p></div>}</div>
            </div>
            <div className="premium-glass rounded-[2rem] p-6 sm:p-7"><p className="premium-eyebrow">Le tue richieste</p><h2 className="mt-2 text-2xl font-black">Inviti inviati</h2><div className="mt-5 space-y-3">{sentInvites.map(invite => <div key={invite.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4"><div><strong className="block">{invite.receiver?.nickname || "Ballerino"}</strong><span className="text-xs text-white/40">{labels.get(invite.style)}</span></div><span className={`rounded-full px-2.5 py-1 text-[.65rem] font-black uppercase ${invite.status === "accepted" ? "bg-emerald-300/10 text-emerald-200" : invite.status === "declined" ? "bg-white/[.06] text-white/35" : "bg-orange-300/10 text-orange-200"}`}>{invite.status === "accepted" ? "Accettato" : invite.status === "declined" ? "Rifiutato" : "In attesa"}</span></div>)}{!sentInvites.length && <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/35">Non hai ancora inviato inviti.</p>}</div></div>
          </div>
          <div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="premium-eyebrow">Community dell’evento</p><h2 className="mt-2 text-3xl font-black">Ballerini in pista</h2><p className="mt-2 text-sm text-white/45">Le compatibilità migliori sono subito invitabili.</p></div><span className="w-fit rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-white/50">{dancers.filter(dancer => dancer.available).length} disponibil{dancers.filter(dancer => dancer.available).length === 1 ? "e" : "i"}</span></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{loading ? <div className="h-56 animate-pulse rounded-3xl bg-white/[.04]" /> : dancers.map(dancer => { const issue = invitationIssue(dancer); const shared = Object.keys(dancer.skills).filter(style => skills[style]); return <article key={dancer.participant_id} className={`premium-card-lift overflow-hidden rounded-3xl border bg-white/[.035] ${issue ? "border-white/10" : "border-pink-300/25"}`}><div className="h-1 bg-gradient-to-r from-pink-500 via-orange-400 to-amber-300 opacity-70" /><div className="p-5"><div className="flex items-center gap-3">{dancer.participant?.avatar_url ? <img src={dancer.participant.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/15" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400/20 to-orange-300/15 text-2xl">♫</span>}<div className="min-w-0"><h3 className="truncate text-xl font-black">{dancer.participant?.nickname || "Ballerino"}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wider text-orange-200">{ROLE_LABELS[dancer.role]}</p></div>{dancer.available && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.8)]" />}</div><div className="mt-4 flex min-h-14 flex-wrap content-start gap-2">{Object.keys(dancer.skills).map(style => <span key={style} className={`rounded-full px-3 py-1 text-xs ${skills[style] ? "bg-pink-400/15 font-bold text-pink-100" : "bg-white/[.05] text-white/35"}`}>{labels.get(style)}</span>)}</div>{shared.length > 0 && <p className="mt-3 text-xs font-bold text-pink-200">{shared.length} {shared.length === 1 ? "stile condiviso" : "stili condivisi"}</p>}<button disabled={Boolean(busy) || Boolean(issue)} onClick={() => void invite(dancer)} className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed ${issue ? "border border-white/10 bg-white/[.025] text-white/30" : "premium-cta bg-gradient-to-r from-pink-500 to-orange-400 text-white"}`}>{busy === dancer.participant_id ? "INVIO…" : issue || "INVITA A BALLARE"}</button></div></article> })}{!loading && !dancers.length && <p className="rounded-3xl border border-dashed border-white/15 p-8 text-white/40">Non ci sono ancora altri profili di ballo in questo evento.</p>}</div>
          </div>
        </>}
      </section>}

      {showMatchPrompt && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="match-profile-title" className="premium-glass w-full max-w-md rounded-[2rem] p-7 text-center shadow-2xl"><span className="text-5xl">♥</span><h2 id="match-profile-title" className="mt-4 text-3xl font-black">Vuoi creare anche il profilo match?</h2><p className="mt-3 leading-6 text-white/55">È facoltativo: puoi scoprire nuove affinità oppure restare soltanto in modalità ballo.</p><button type="button" onClick={() => router.push(`/evento/${code}/questionario`)} className="premium-cta mt-6 w-full rounded-full bg-gradient-to-r from-pink-500 to-orange-400 px-6 py-4 font-black">CREA PROFILO MATCH</button><button type="button" onClick={() => setShowMatchPrompt(false)} className="mt-3 w-full rounded-full border border-white/15 px-6 py-4 font-black text-white/65">RESTA IN MODALITÀ BALLO</button></section></div>}
    </div>
  </main>
}
