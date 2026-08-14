"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation"
import Logo from "@/app/components/Logo"
import { publicSupabase } from "@/lib/supabase"

type AttivitaId = "match" | "social" | "missioni" | "tavoli" | "balla"

type VoceMenu = {
  id: AttivitaId
  icon: string
  title: string
  description: string
  badge?: string
}

const MENU_ICONS: Record<AttivitaId, string> = {
  tavoli: "\u{1F3B2}",
  balla: "\u{1F483}",
  match: "\u2665",
  social: "\u{1F91D}",
  missioni: "\u{1F3AF}",
}

const vociMenu: VoceMenu[] = [
  {
    id: "balla",
    icon: "💃",
    title: "Invita a ballare",
    description: "Trova skill compatibili e manda un invito in pista.",
    badge: "Live",
  },
  {
    id: "tavoli",
    icon: "🎲",
    title: "Tavoli gioco",
    description: "Controlla gli inviti e prenota il tuo posto.",
    badge: "Live",
  },
  {
    id: "match",
    icon: "❤️",
    title: "Trova un match",
    description:
      "Scopri le persone con cui hai maggiore affinità.",
  },
  {
    id: "social",
    icon: "🤝",
    title: "Conosci nuove persone",
    description:
      "Trova qualcuno con cui parlare, ballare o fare gruppo.",
  },
  {
    id: "missioni",
    icon: "🎯",
    title: "Missioni e premi",
    description:
      "Completa sfide sociali, guadagna punti e prova a vincere.",
    badge: "Nuovo",
  },
]

export default function ExperienceSidebar() {
  const params = useParams<{
    code: string
  }>()

  const pathname = usePathname()
  const router = useRouter()

  const [aperto, setAperto] = useState(false)
  const [caribbeanMode, setCaribbeanMode] = useState(false)
  const [attivitaAttuale, setAttivitaAttuale] =
    useState<AttivitaId>("match")
  const [notificheAttive, setNotificheAttive] =
    useState(false)
  const [permessoNotifiche, setPermessoNotifiche] =
    useState<NotificationPermission | "unsupported">(
      "unsupported"
    )

  const eventCode = params.code

  useEffect(() => {
    void publicSupabase.from("events").select("experience_mode").eq("code", eventCode).maybeSingle()
      .then(({data}) => setCaribbeanMode(data?.experience_mode === "caribbean"))
  }, [eventCode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const notificheSalvate =
        localStorage.getItem("zocyal_chat_notifications") ===
        "true"
      setNotificheAttive(notificheSalvate)
      setPermessoNotifiche(
        "Notification" in window ? Notification.permission : "unsupported"
      )
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (pathname.includes("/balla")) {
      setAttivitaAttuale("balla")
      localStorage.setItem("zocyal_activity", "balla")
      return
    }
    if (pathname.includes("/tavoli")) {
      setAttivitaAttuale("tavoli")
      localStorage.setItem("zocyal_activity", "tavoli")
      return
    }

    if (pathname.includes("/missioni")) {
      setAttivitaAttuale("missioni")
      localStorage.setItem("zocyal_activity", "missioni")
      return
    }

    if (pathname.includes("/social")) {
      setAttivitaAttuale("social")
      localStorage.setItem("zocyal_activity", "social")
      return
    }

    if (
      pathname.includes("/compatibilita") ||
      pathname.includes("/miei-match") ||
      pathname.includes("/chat")
    ) {
      setAttivitaAttuale("match")
      localStorage.setItem("zocyal_activity", "match")
      return
    }

    const attivitaSalvata =
      localStorage.getItem("zocyal_activity") as
        | AttivitaId
        | null

    if (
      attivitaSalvata === "match" ||
      attivitaSalvata === "social" ||
      attivitaSalvata === "missioni"
      || attivitaSalvata === "tavoli" || attivitaSalvata === "balla"
    ) {
      setAttivitaAttuale(attivitaSalvata)
    }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    const timer = window.setTimeout(() => setAperto(false), 0)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    if (!aperto) {
      document.body.style.overflow = ""
      return
    }

    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [aperto])

  async function cambiaStatoNotifiche() {
    if (notificheAttive) {
      setNotificheAttive(false)

      localStorage.setItem(
        "zocyal_chat_notifications",
        "false"
      )

      return
    }

    if (!("Notification" in window)) {
      setPermessoNotifiche("unsupported")
      setNotificheAttive(true)

      localStorage.setItem(
        "zocyal_chat_notifications",
        "true"
      )

      return
    }

    let permesso = Notification.permission

    if (permesso === "default") {
      permesso = await Notification.requestPermission()
    }

    setPermessoNotifiche(permesso)
    setNotificheAttive(true)

    localStorage.setItem(
      "zocyal_chat_notifications",
      "true"
    )
  }

  function testoStatoNotifiche() {
    if (notificheAttive && permessoNotifiche === "granted") {
      return "Notifiche attive"
    }

    if (notificheAttive && permessoNotifiche === "denied") {
      return "Solo suono disponibile"
    }

    if (
      notificheAttive &&
      permessoNotifiche === "unsupported"
    ) {
      return "Avvisi interni attivi"
    }

    if (permessoNotifiche === "denied") {
      return "Notifiche bloccate"
    }

    if (permessoNotifiche === "unsupported") {
      return "Notifiche non supportate"
    }

    return "Notifiche disponibili"
  }

  function selezionaAttivita(attivita: AttivitaId) {
    setAttivitaAttuale(attivita)
    localStorage.setItem("zocyal_activity", attivita)
    setAperto(false)

    if (attivita === "balla") {
      router.push(`/evento/${eventCode}/balla`)
      return
    }

    if (attivita === "tavoli") {
      router.push(`/evento/${eventCode}/tavoli`)
      return
    }

    if (attivita === "match") {
      router.push(`/evento/${eventCode}/compatibilita`)
      return
    }

    if (attivita === "social") {
      router.push(`/evento/${eventCode}/social`)
      return
    }

    router.push(`/evento/${eventCode}/missioni`)
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setAperto(true)}
        aria-label="Apri menu attività"
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02, y: -2 }}
        className={`group fixed right-3 z-40 flex h-14 w-auto items-center justify-center gap-3 overflow-hidden rounded-2xl border border-pink-300/20 bg-[#130b16]/90 px-3.5 pr-5 text-white shadow-[0_16px_45px_rgba(0,0,0,.45),0_0_28px_rgba(236,72,153,.18),inset_0_1px_rgba(255,255,255,.08)] backdrop-blur-xl transition-[bottom,border-color,box-shadow,transform] hover:border-pink-300/40 hover:shadow-[0_18px_50px_rgba(0,0,0,.5),0_0_34px_rgba(236,72,153,.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70 [&>span]:hidden sm:right-6 ${
          pathname.includes("/chat/")
            ? "bottom-[calc(env(safe-area-inset-bottom)+7rem)] sm:bottom-28"
            : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-10"
        }`}
      >
        <div aria-hidden="true" className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-pink-200/70 to-transparent" />
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 shadow-[0_6px_20px_rgba(236,72,153,.3)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h9" /></svg>
        </div>
        <div className="text-left"><span className="block text-[9px] font-bold uppercase tracking-[.2em] text-pink-200/55">Menu</span><span className="mt-0.5 block text-xs font-black uppercase tracking-[.12em]">Attivit&agrave;</span></div>
        <span aria-hidden="true" className="text-lg">☰</span>
        <span className="text-[11px] font-black uppercase tracking-[.12em]">Attività</span>
      </motion.button>

      <AnimatePresence>
        {aperto && (
          <>
            <motion.button
              type="button"
              aria-label="Chiudi menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setAperto(false)}
              className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 28,
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90svh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-white/10 bg-[#0c080e]/95 text-white shadow-[0_-24px_90px_rgba(0,0,0,.65)] backdrop-blur-2xl sm:bottom-0 sm:left-auto sm:top-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-l sm:border-t-0 sm:shadow-[-30px_0_100px_rgba(0,0,0,.65)]"
            >
              <div className="pointer-events-none absolute right-[-100px] top-[-120px] h-[320px] w-[320px] rounded-full bg-fuchsia-600/20 blur-[100px]" />
              <div className="pointer-events-none absolute bottom-[-120px] left-[-100px] h-[300px] w-[300px] rounded-full bg-orange-500/10 blur-[100px]" />

              <div className="relative flex items-center justify-between border-b border-white/[.08] px-5 py-4 sm:px-6">
                <Logo size="small" />

                <button
                  type="button"
                  onClick={() => setAperto(false)}
                  aria-label="Chiudi menu"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl text-gray-300 transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-400">
                  Vivi la serata
                </p>

                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  Scegli la tua esperienza
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Tutto ci&ograve; che puoi fare durante la serata, in un solo posto.
                </p>


                <button
                  type="button"
                  onClick={() => {
                    setAperto(false)
                    router.push(`/evento/${eventCode}/mio-profilo`)
                  }}
                  className={`mt-5 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    pathname.includes("/mio-profilo")
                      ? "border-pink-400/50 bg-gradient-to-r from-fuchsia-600/20 via-pink-500/15 to-orange-400/10"
                      : "border-white/10 bg-white/[0.04] hover:border-pink-400/30 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10 text-2xl">
                    👤
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-black text-white">
                      Il mio profilo
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      Mostra foto, nome e codice personale durante la serata.
                    </p>
                  </div>

                  <span className="text-xl text-white/30">
                    ›
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAperto(false)
                    router.push(`/evento/${eventCode}/miei-match`)
                  }}
                  className={`mt-2 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    pathname.includes("/miei-match") ||
                    pathname.includes("/chat")
                      ? "border-pink-400/50 bg-gradient-to-r from-fuchsia-600/20 via-pink-500/15 to-orange-400/10"
                      : "border-white/10 bg-white/[0.04] hover:border-pink-400/30 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10 text-2xl">
                    💬
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-black text-white">
                      Le mie chat
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      Vedi match, ultimi messaggi e conversazioni della serata.
                    </p>
                  </div>

                  <span className="text-xl text-white/30">
                    ›
                  </span>
                </button>

                <div className="mt-7 border-t border-white/[.08] pt-5"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">Esperienze</p><span className="text-[10px] font-bold text-white/25">Scegline una</span></div><div className="grid gap-2">
                  {vociMenu.filter(voce => caribbeanMode ? voce.id !== "tavoli" : voce.id !== "balla").map((voce, index) => {
                    const attiva = attivitaAttuale === voce.id

                    return (
                      <motion.button
                        key={voce.id}
                        type="button"
                        onClick={() => selezionaAttivita(voce.id)}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.08 + index * 0.07,
                        }}
                        whileTap={{ scale: 0.98 }}
                        className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                          attiva
                            ? "border-pink-400/50 bg-gradient-to-r from-fuchsia-600/20 via-pink-500/15 to-orange-400/10 shadow-[0_16px_45px_rgba(236,72,153,0.12)]"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                        }`}
                      >
                        {attiva && (
                          <>
                            <motion.div
                              layoutId="attivita-attiva"
                              className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-fuchsia-500 via-pink-500 to-orange-400"
                            />
                            <div className="pointer-events-none absolute right-[-40px] top-[-40px] h-28 w-28 rounded-full bg-pink-500/10 blur-3xl" />
                          </>
                        )}

                        <div className="relative flex items-start gap-4">
                          <motion.div
                            animate={
                              attiva
                                ? { scale: [1, 1.08, 1] }
                                : { scale: 1 }
                            }
                            transition={{
                              duration: 1.8,
                              repeat: 0,
                              repeatDelay: 2,
                            }}
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${attiva ? "bg-pink-400/15" : "bg-white/[.05]"}`}
                          >
                            {MENU_ICONS[voce.id]}
                          </motion.div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-lg font-black transition ${
                                  attiva
                                    ? "text-pink-300"
                                    : "text-white group-hover:text-pink-300"
                                }`}
                              >
                                {voce.title}
                              </h3>

                              {voce.badge && (
                                <span className="rounded-full border border-orange-400/25 bg-orange-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-orange-300">
                                  {voce.badge}
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-sm leading-6 text-gray-400">
                              {voce.description}
                            </p>
                          </div>

                          <span
                            className={`mt-1 text-2xl transition ${
                              attiva
                                ? "text-pink-300"
                                : "text-white/20 group-hover:translate-x-1 group-hover:text-pink-300"
                            }`}
                          >
                            ›
                          </span>
                        </div>
                      </motion.button>
                    )
                  })}
                </div></div>

                <div className="mt-5 border-t border-white/[.08] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">
                    Avvisi
                  </p>

                  <button
                    type="button"
                    onClick={cambiaStatoNotifiche}
                    className={`mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      notificheAttive
                        ? "border-green-400/30 bg-green-400/10"
                        : "border-white/10 bg-white/[0.04] hover:border-pink-400/30 hover:bg-white/[0.07]"
                    }`}
                  >
                    <div
                      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
                        notificheAttive
                          ? "bg-green-400/15"
                          : "bg-white/[0.06]"
                      }`}
                    >
                      {notificheAttive ? "🔔" : "🔕"}

                      {notificheAttive && (
                        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-green-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white">
                        {testoStatoNotifiche()}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        {notificheAttive
                          ? "Tocca per disattivare gli avvisi."
                          : "Tocca per controllare e attivare gli avvisi."}
                      </p>
                    </div>

                    <span className="text-xl text-white/30">
                      ›
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative border-t border-white/10 px-6 py-5">
                <p className="text-center text-xs leading-5 text-gray-500">
                  Puoi cambiare modalità senza perdere profilo,
                  match o conversazioni.
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
