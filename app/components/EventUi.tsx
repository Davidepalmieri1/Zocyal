"use client"

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
