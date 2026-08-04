"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

type Person = {
  id: string
  nickname: string | null
  avatar_url: string | null
}

type Report = {
  id: string
  match_id: string
  reported_by: string
  reported_participant: string
  reason: string | null
  details: string | null
  status: string | null
  created_at: string
  reporter: Person | null
  reported: Person | null
  suspended: boolean
}

async function responseJson(response: Response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || "Operazione non riuscita.")
  return payload
}

export default function ReportsPage() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.trim().toLowerCase()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState("")
  const [suspending, setSuspending] = useState("")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch(`/admin/api/reports?code=${encodeURIComponent(code)}`, {
        credentials: "same-origin",
        cache: "no-store",
      })
      const data = await responseJson(response)
      setReports(data.reports || [])
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore inatteso.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [code])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true)
    }, 30000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [load])

  async function removeParticipant(report: Report) {
    const person = report.reported
    if (!person) return
    if (!window.confirm(`Eliminare definitivamente ${person.nickname || "questo partecipante"} dall'evento ${code}? Verranno rimossi anche match, messaggi, punti e premi collegati.`)) return

    const password = window.prompt("Inserisci la password amministrativa usata per eliminare gli eventi:")
    if (password === null) return

    setDeleting(person.id)
    setError("")
    try {
      const response = await fetch("/admin/api/reports", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, participantId: person.id, password }),
      })
      await responseJson(response)
      setReports((current) => current.filter((item) => item.reported_participant !== person.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Eliminazione non riuscita.")
    } finally {
      setDeleting("")
    }
  }

  async function suspendParticipant(report: Report) {
    const person = report.reported
    if (!person || report.suspended) return
    if (!window.confirm(`Oscurare ${person.nickname || "questo partecipante"}? Non potrà più usare il profilo o crearne uno nuovo durante l'evento.`)) return

    const password = window.prompt("Inserisci la password amministrativa usata per eliminare gli eventi:")
    if (password === null) return

    setSuspending(person.id)
    setError("")
    try {
      const response = await fetch("/admin/api/reports", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, participantId: person.id, password }),
      })
      await responseJson(response)
      setReports((current) => current.map((item) => item.reported_participant === person.id ? { ...item, suspended: true } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Oscuramento non riuscito.")
    } finally {
      setSuspending("")
    }
  }

  const open = reports.filter((report) => report.status === "open").length

  return (
    <div className="flex min-h-screen bg-[#050306] text-white">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-hidden px-4 pb-10 pt-20 sm:px-6 lg:p-8">
        <PremiumBackdrop orbs={false} />
        <div className="relative mx-auto max-w-6xl">
          <header className="border-b border-white/[.07] pb-7">
            <p className="premium-eyebrow text-red-300">Sicurezza evento</p>
            <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="premium-title text-4xl font-black sm:text-6xl">Segnalazioni.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
                  Controlla le segnalazioni ricevute e intervieni sui partecipanti dell&apos;evento <strong className="text-pink-300">{code}</strong>.
                </p>
              </div>
              <button type="button" onClick={() => void load(true)} className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black text-white/60">
                AGGIORNA
              </button>
            </div>
          </header>

          <section className="mt-6 grid grid-cols-2 gap-3">
            <article className="premium-glass rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Totali</p>
              <p className="mt-3 text-3xl font-black">{reports.length}</p>
            </article>
            <article className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-red-200/60">Da valutare</p>
              <p className="mt-3 text-3xl font-black text-red-300">{open}</p>
            </article>
          </section>

          {error && <p role="alert" className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}

          {loading ? (
            <div className="mt-6 h-64 animate-pulse rounded-[2rem] bg-white/[.04]" />
          ) : (
            <section aria-live="polite" className="mt-6 grid gap-4">
              {reports.map((report) => (
                <article key={report.id} className="premium-glass overflow-hidden rounded-[1.75rem] border-red-400/10 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-red-300/20 bg-red-400/10 text-2xl font-black text-red-200">
                        {report.reported?.avatar_url ? <img src={report.reported.avatar_url} alt="" className="h-full w-full object-cover" /> : (report.reported?.nickname || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-xl font-black">{report.reported?.nickname || "Partecipante non disponibile"}</h2>
                          <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${report.status === "open" ? "bg-red-400/15 text-red-300" : "bg-white/[.06] text-white/40"}`}>
                            {report.suspended ? "Oscurato" : report.status === "open" ? "Da valutare" : report.status || "Segnalata"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/35">Segnalato da {report.reporter?.nickname || "partecipante"} · {new Date(report.created_at).toLocaleString("it-IT")}</p>
                      </div>
                    </div>
                    {report.reported && <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={Boolean(deleting || suspending || report.suspended)}
                        onClick={() => void suspendParticipant(report)}
                        className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs font-black text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {suspending === report.reported.id ? "OSCURAMENTO…" : report.suspended ? "UTENTE OSCURATO" : "OSCURA UTENTE"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(deleting || suspending)}
                        onClick={() => void removeParticipant(report)}
                        className="shrink-0 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs font-black text-red-200 transition hover:bg-red-400/20 disabled:cursor-wait disabled:opacity-45"
                      >
                        {deleting === report.reported.id ? "ELIMINAZIONE…" : "ELIMINA UTENTE"}
                      </button>
                    </div>}
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/[.07] bg-black/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-pink-300">{report.reason || "Motivo non specificato"}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">{report.details || "Nessun dettaglio aggiuntivo."}</p>
                  </div>
                </article>
              ))}
              {reports.length === 0 && (
                <div className="premium-glass rounded-[2rem] p-10 text-center">
                  <p className="text-4xl">✓</p>
                  <h2 className="mt-4 text-xl font-black">Nessuna segnalazione</h2>
                  <p className="mt-2 text-sm text-white/40">Al momento non risultano segnalazioni per questo evento.</p>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
