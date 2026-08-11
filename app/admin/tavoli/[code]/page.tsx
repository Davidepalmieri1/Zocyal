"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

const INTERESTS = [
  "Conoscere tante persone",
  "Stare con pochi amici",
  "Seguire il ritmo della serata",
  "Concentrarmi su una persona",
  "Ballare e divertirti",
  "Parlare e conoscere persone",
  "Fare nuove esperienze",
  "Rilassarmi senza programmi",
  "Avventura e sorprese",
  "Musica e movimento",
  "Conversazioni profonde",
  "Relax e tranquillità",
  "Fare nuove amicizie",
  "Trovare una connessione speciale",
  "Uscire dalla routine",
  "Vivere il momento",
  "Il sorriso",
  "Il modo di parlare",
  "L'energia",
  "Lo stile",
  "Viaggi ed esperienze",
  "Passioni e progetti",
  "Storie divertenti",
  "Emozioni e vita personale",
  "Coinvolgere tutti",
  "Osservare prima di aprirmi",
  "Legare con poche persone",
  "Seguire chi propone qualcosa",
  "La complicitÃ ",
  "Una risata spontanea",
  "Una sorpresa",
  "Sentirsi ascoltati",
]

type Invite = {
  id: string
  status: "pending" | "accepted" | "declined" | "joined"
  points_awarded: number
  participant: {
    id: string
    nickname: string | null
    avatar_url: string | null
  } | null
}

type Table = {
  id: string
  name: string
  game: string
  interest_tags: string[]
  points_reward: number
  max_participants: number
  status: "open" | "closed"
  invitations: Invite[]
}

type GameTemplate = {
  id: string
  name: string
  interest_tags: string[]
  points_reward: number
  created_at: string
  updated_at: string
}

type ApiPayload = {
  error?: string
  tables?: Table[]
  templates?: GameTemplate[]
  invited?: number
  template?: GameTemplate
}

const STATUS_LABELS = {
  pending: "In attesa",
  accepted: "Accettato",
  declined: "Rifiutato",
  joined: "Presente",
} as const

export default function GameTablesAdminPage() {
  const { code: raw } = useParams<{ code: string }>()
  const code = raw.toLowerCase()
  const [tables, setTables] = useState<Table[]>([])
  const [templates, setTemplates] = useState<GameTemplate[]>([])
  const [tableName, setTableName] = useState("")
  const [gameName, setGameName] = useState("")
  const [points, setPoints] = useState(3)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    const response = await fetch(
      `/admin/api/game-tables?code=${encodeURIComponent(code)}`,
      { cache: "no-store" }
    )
    const payload = (await response.json()) as ApiPayload
    if (!response.ok) throw new Error(payload.error)
    setTables(payload.tables || [])
    setTemplates(payload.templates || [])
  }, [code])

  useEffect(() => {
    const initial = window.setTimeout(() => {
      load()
        .catch((error) => setMessage(error.message))
        .finally(() => setLoading(false))
    }, 0)
    const timer = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 30000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [load])

  const stats = useMemo(() => {
    const openTables = tables.filter((table) => table.status === "open").length
    const pendingInvites = tables.reduce(
      (total, table) =>
        total + table.invitations.filter((invite) => invite.status === "pending").length,
      0
    )
    return { openTables, pendingInvites }
  }, [tables])

  async function mutate(body: Record<string, unknown>) {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/admin/api/game-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_code: code, ...body }),
      })
      const payload = (await response.json()) as ApiPayload
      if (!response.ok) throw new Error(payload.error)
      await load()
      return payload
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operazione non riuscita.")
      return null
    } finally {
      setBusy(false)
    }
  }

  function toggleInterest(interest: string) {
    setSelectedInterests((current) => {
      if (current.includes(interest)) return current.filter((item) => item !== interest)
      if (current.length >= 12) {
        setMessage("Puoi selezionare al massimo 12 interessi per tavolo.")
        return current
      }
      return [...current, interest]
    })
    setSelectedTemplate(null)
  }

  function applyTemplate(template: GameTemplate) {
    setSelectedTemplate(template.id)
    setGameName(template.name)
    setPoints(template.points_reward)
    setSelectedInterests(template.interest_tags)
    setMessage(`“${template.name}” è pronto: aggiungi il nome del tavolo e crea gli inviti.`)
  }

  async function saveGame() {
    const payload = await mutate({
      action: "save_template",
      game: gameName,
      points_reward: points,
      interest_tags: selectedInterests,
    })
    if (payload?.template) {
      setSelectedTemplate(payload.template.id)
      setMessage(`Gioco “${payload.template.name}” salvato per i prossimi eventi.`)
    }
  }

  async function deleteGame(template: GameTemplate) {
    const payload = await mutate({
      action: "delete_template",
      template_id: template.id,
    })
    if (payload) {
      if (selectedTemplate === template.id) setSelectedTemplate(null)
      setMessage(`Gioco “${template.name}” rimosso dal catalogo.`)
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = await mutate({
      action: "create",
      name: tableName,
      game: gameName,
      points_reward: points,
      interest_tags: selectedInterests,
    })
    if (payload) {
      setMessage(`Tavolo creato: ${payload.invited || 0} inviti compatibili inviati.`)
      setTableName("")
    }
  }

  return (
    <div className="flex min-h-screen bg-[#050306] text-white">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-hidden px-4 pb-16 pt-20 sm:px-6 lg:p-8">
        <PremiumBackdrop />
        <div className="relative mx-auto max-w-7xl">
          <header className="premium-enter border-b border-white/[.07] pb-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="premium-eyebrow">Social games studio</p>
                <h1 className="premium-title premium-gradient-text mt-3 text-5xl font-black sm:text-7xl">
                  Tavoli gioco.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
                  Crea esperienze memorabili, invita le persone giuste e conserva i
                  giochi migliori per riutilizzarli in ogni evento.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  ["Tavoli live", stats.openTables, "text-pink-200"],
                  ["Giochi salvati", templates.length, "text-orange-200"],
                  ["Inviti attivi", stats.pendingInvites, "text-fuchsia-200"],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="premium-glass min-w-0 rounded-2xl p-3 text-center sm:p-4">
                    <p className={`text-2xl font-black sm:text-3xl ${tone}`}>{value}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-white/35 sm:text-[10px]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {message && (
            <p role="status" className="premium-enter mt-5 rounded-2xl border border-pink-400/20 bg-pink-400/10 p-4 text-sm text-pink-100">
              {message}
            </p>
          )}

          <section className="premium-enter premium-enter-delay-1 mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="premium-eyebrow">La tua libreria</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Giochi salvati</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white/40">
                Riutilizzabili
              </span>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-44 animate-pulse rounded-[2rem] bg-white/[.04]" />
                ))}
              </div>
            ) : templates.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((template, index) => {
                  const active = selectedTemplate === template.id
                  return (
                    <article
                      key={template.id}
                      className={`premium-card-lift premium-enter group relative overflow-hidden rounded-[2rem] border p-5 transition ${
                        active
                          ? "border-pink-300/55 bg-gradient-to-br from-pink-500/20 via-fuchsia-500/10 to-orange-400/10 shadow-[0_22px_80px_rgba(236,72,153,.18)]"
                          : "border-white/10 bg-white/[.035]"
                      }`}
                      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
                    >
                      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-pink-400/10 blur-3xl transition group-hover:bg-pink-400/20" />
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300/70">
                            Gioco pronto
                          </p>
                          <h3 className="mt-2 truncate text-2xl font-black">{template.name}</h3>
                        </div>
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[.06] text-2xl transition group-hover:rotate-6 group-hover:scale-110">
                          🎲
                        </span>
                      </div>
                      <div className="relative mt-5 flex items-center justify-between gap-3 text-xs">
                        <span className="rounded-full bg-orange-300/10 px-3 py-1.5 font-black text-orange-200">
                          +{template.points_reward} punti
                        </span>
                        <span className="text-white/35">{template.interest_tags.length} interessi</span>
                      </div>
                      <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-2">
                        <button
                          type="button"
                          onClick={() => applyTemplate(template)}
                          disabled={busy}
                          className={`rounded-full px-4 py-3 text-xs font-black transition ${
                            active
                              ? "bg-white text-black"
                              : "bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 text-white"
                          }`}
                        >
                          {active ? "SELEZIONATO ✓" : "USA QUESTO GIOCO"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteGame(template)}
                          disabled={busy}
                          aria-label={`Rimuovi ${template.name}`}
                          className="rounded-full border border-white/10 px-4 text-white/35 transition hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-200"
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="premium-glass mt-5 rounded-[2rem] border-dashed p-8 text-center sm:p-10">
                <span className="text-5xl">✦</span>
                <h3 className="mt-4 text-xl font-black">Crea la tua libreria di giochi</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/40">
                  Compila il gioco qui sotto e premi “Salva per altri eventi”. La prossima volta sarà pronto con un solo tocco.
                </p>
              </div>
            )}
          </section>

          <form onSubmit={create} className="premium-glass premium-enter premium-enter-delay-2 relative mt-8 overflow-hidden rounded-[2.25rem] p-5 sm:p-8">
            <div className="absolute -right-28 top-0 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-[80px]" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="premium-eyebrow">Configurazione rapida</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Crea un nuovo tavolo</h2>
                <p className="mt-2 text-sm text-white/40">Massimo 6 partecipanti, selezionati per interessi compatibili.</p>
              </div>
              {selectedTemplate && (
                <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                  Modello applicato
                </span>
              )}
            </div>

            <div className="relative mt-6 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-black uppercase tracking-wider text-white/45">
                Nome tavolo
                <input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  required
                  maxLength={120}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[.07] px-4 py-4 text-base font-bold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-pink-400/55 focus:ring-4 focus:ring-pink-500/10"
                  placeholder="Tavolo Luna"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-white/45">
                Gioco
                <input
                  value={gameName}
                  onChange={(event) => {
                    setGameName(event.target.value)
                    setSelectedTemplate(null)
                  }}
                  required
                  maxLength={120}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[.07] px-4 py-4 text-base font-bold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-pink-400/55 focus:ring-4 focus:ring-pink-500/10"
                  placeholder="Obbligo o Verità"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-white/45">
                Punti presenza
                <input
                  value={points}
                  onChange={(event) => {
                    setPoints(Number(event.target.value))
                    setSelectedTemplate(null)
                  }}
                  type="number"
                  min="1"
                  max="10"
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[.07] px-4 py-4 text-base font-bold normal-case tracking-normal text-white outline-none focus:border-pink-400/55 focus:ring-4 focus:ring-pink-500/10"
                />
              </label>
            </div>

            <fieldset className="relative mt-6">
              <legend className="text-xs font-black uppercase tracking-wider text-white/45">
                Interessi compatibili
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {INTERESTS.map((item) => {
                  const checked = selectedInterests.includes(item)
                  return (
                    <label
                      key={item}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-semibold transition ${
                        checked
                          ? "border-pink-300/45 bg-pink-400/15 text-pink-100 shadow-[0_12px_35px_rgba(236,72,153,.08)]"
                          : "border-white/10 bg-white/[.035] text-white/55 hover:bg-white/[.06]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInterest(item)}
                        className="h-4 w-4 accent-pink-500"
                      />
                      {item}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={() => void saveGame()}
                disabled={busy}
                className="rounded-full border border-pink-300/25 bg-pink-400/10 px-6 py-4 text-xs font-black uppercase tracking-[.08em] text-pink-100 transition hover:border-pink-300/45 hover:bg-pink-400/20 disabled:opacity-50"
              >
                ☆ Salva per altri eventi
              </button>
              <button
                disabled={busy}
                className="premium-cta rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-7 py-4 text-xs font-black uppercase tracking-[.1em] text-white disabled:opacity-50 sm:justify-self-end"
              >
                {busy ? "OPERAZIONE IN CORSO…" : "CREA TAVOLO E INVITA ↗"}
              </button>
            </div>
          </form>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="premium-eyebrow">Regia della serata</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Tavoli dell’evento</h2>
              </div>
              <span className="text-xs font-bold text-white/30">Aggiornamento automatico</span>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              {loading ? (
                <div className="h-64 animate-pulse rounded-[2rem] bg-white/[.04]" />
              ) : (
                tables.map((table, index) => {
                  const occupied = table.invitations.filter(
                    (invite) => invite.status === "accepted" || invite.status === "joined"
                  ).length
                  const capacity = table.max_participants || 6
                  return (
                    <article
                      key={table.id}
                      className="premium-card-lift premium-enter relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035] p-5 sm:p-6"
                      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
                    >
                      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-orange-400/[.06] blur-3xl" />
                      <div className="relative flex justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-black uppercase tracking-[.15em] text-pink-300">{table.game}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${table.status === "open" ? "bg-emerald-300/10 text-emerald-200" : "bg-white/[.06] text-white/35"}`}>
                              {table.status === "open" ? "Live" : "Chiuso"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-2xl font-black sm:text-3xl">{table.name}</h3>
                          <p className="mt-3 text-sm text-white/40">
                            {occupied}/{capacity} posti · <strong className="text-orange-200">+{table.points_reward} punti</strong>
                          </p>
                        </div>
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[.05] text-3xl">🎲</span>
                      </div>

                      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-400 to-orange-300 transition-all duration-700"
                          style={{ width: `${Math.min(100, (occupied / capacity) * 100)}%` }}
                        />
                      </div>
                      <div className="relative mt-4 flex flex-wrap gap-2">
                        {table.interest_tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-white/[.06] bg-white/[.045] px-3 py-1.5 text-[10px] font-bold text-white/45">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="relative mt-5 grid gap-2">
                        {table.invitations.map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-black/20 p-3">
                            <span className="truncate text-sm font-bold">{invite.participant?.nickname || "Partecipante"}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">{STATUS_LABELS[invite.status]}</span>
                              {invite.status === "accepted" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void mutate({ action: "mark_joined", invitation_id: invite.id })}
                                  className="rounded-full bg-emerald-300 px-3 py-2 text-[9px] font-black text-black"
                                >
                                  CONFERMA
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {!table.invitations.length && (
                          <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/35">
                            Nessun partecipante compatibile.
                          </p>
                        )}
                      </div>
                      {table.status === "open" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void mutate({ action: "close", table_id: table.id })}
                          className="relative mt-5 rounded-full border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white/45 transition hover:bg-white/[.06] hover:text-white"
                        >
                          Chiudi tavolo
                        </button>
                      )}
                    </article>
                  )
                })
              )}
              {!loading && !tables.length && (
                <div className="premium-glass rounded-[2rem] p-10 text-center text-white/40 xl:col-span-2">
                  Nessun tavolo ancora. Scegli un gioco salvato o creane uno nuovo.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
