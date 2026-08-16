"use client"

import { useRouter } from "next/navigation"

type FeedbackTone = "success" | "error" | "info"

const feedbackStyles: Record<FeedbackTone, string> = {
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  error: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  info: "border-sky-300/20 bg-sky-300/10 text-sky-100",
}

const feedbackIcons: Record<FeedbackTone, string> = {
  success: "✓",
  error: "!",
  info: "i",
}

export function ActionFeedback({ message, tone = "info", className = "" }: { message: string; tone?: FeedbackTone; className?: string }) {
  if (!message) return null
  return <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${feedbackStyles[tone]} ${className}`}>
    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/25 text-xs font-black">{feedbackIcons[tone]}</span>
    <p className="leading-6">{message}</p>
  </div>
}

export function EmptyState({ icon, title, description, className = "" }: { icon: string; title: string; description: string; className?: string }) {
  return <div className={`rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.025] p-8 text-center ${className}`}>
    <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.04] text-2xl text-white/60">{icon}</span>
    <h3 className="mt-4 font-black text-white/75">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">{description}</p>
  </div>
}

export function LiveSyncStatus({ updatedAt, label = "Aggiornamento live" }: { updatedAt: Date | null; label?: string }) {
  return <p aria-live="polite" className="inline-flex items-center gap-2 text-[11px] font-bold text-white/35">
    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${updatedAt ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.65)]" : "animate-pulse bg-white/30"}`} />
    {updatedAt ? `${label} · ${updatedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Sincronizzazione…"}
  </p>
}

export function EventBackButton({ href, label = "Torna indietro" }: { href: string; label?: string }) {
  const router = useRouter()
  return <button type="button" onClick={() => router.replace(href)} aria-label={label} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl text-white transition hover:border-pink-400/40 hover:bg-pink-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70">
    ‹
  </button>
}

export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, tone = "danger", onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; tone?: "danger" | "primary"; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null
  return <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/80 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur-sm sm:items-center sm:py-6">
    <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="premium-glass max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-[#0b070d]/95 p-6 text-center shadow-2xl">
      <span aria-hidden="true" className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl ${tone === "danger" ? "border-red-300/25 bg-red-400/10 text-red-200" : "border-pink-300/25 bg-pink-400/10 text-pink-100"}`}>{tone === "danger" ? "!" : "✓"}</span>
      <h2 id="confirm-dialog-title" className="mt-4 text-2xl font-black">{title}</h2>
      <p id="confirm-dialog-description" className="mt-3 text-sm leading-6 text-white/55">{description}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" autoFocus disabled={busy} onClick={onCancel} className="min-h-12 rounded-xl border border-white/10 px-4 py-3 font-black text-white/70 disabled:opacity-50">ANNULLA</button>
        <button type="button" disabled={busy} onClick={onConfirm} className={`min-h-12 rounded-xl px-4 py-3 font-black disabled:cursor-wait disabled:opacity-50 ${tone === "danger" ? "bg-red-500 text-white" : "bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 text-white"}`}>{busy ? "ATTENDI…" : confirmLabel}</button>
      </div>
    </section>
  </div>
}
