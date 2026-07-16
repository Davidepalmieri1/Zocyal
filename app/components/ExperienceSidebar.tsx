"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation"
import Logo from "@/app/components/Logo"

type AttivitaId = "match" | "social" | "missioni"

type VoceMenu = {
  id: AttivitaId
  icon: string
  title: string
  description: string
  badge?: string
}

const vociMenu: VoceMenu[] = [
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
    const notificheSalvate =
      localStorage.getItem("zocyal_chat_notifications") ===
      "true"

    setNotificheAttive(notificheSalvate)

    if ("Notification" in window) {
      setPermessoNotifiche(Notification.permission)
    } else {
      setPermessoNotifiche("unsupported")
    }
  }, [])

  useEffect(() => {
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
    ) {
      setAttivitaAttuale(attivitaSalvata)
    }
  }, [pathname])

  useEffect(() => {
    setAperto(false)
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
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        className={`fixed right-4 z-40 flex items-center justify-center rounded-full border border-pink-400/30 bg-gradient-to-br from-fuchsia-600 via-pink-500 to-orange-400 text-white shadow-[0_0_40px_rgba(236,72,153,0.35)] transition-[bottom,width,height] sm:right-6 ${
          pathname.includes("/chat/")
            ? "bottom-24 h-12 w-12 text-xl sm:bottom-28"
            : "bottom-6 h-14 w-14 text-2xl"
        }`}
      >
        ☰
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
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 28,
              }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-[88%] max-w-sm flex-col overflow-hidden border-l border-white/10 bg-zinc-950 text-white shadow-[-30px_0_100px_rgba(0,0,0,0.65)]"
            >
              <div className="pointer-events-none absolute right-[-100px] top-[-120px] h-[320px] w-[320px] rounded-full bg-fuchsia-600/20 blur-[100px]" />
              <div className="pointer-events-none absolute bottom-[-120px] left-[-100px] h-[300px] w-[300px] rounded-full bg-orange-500/10 blur-[100px]" />

              <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-6">
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

              <div className="relative flex-1 overflow-y-auto px-5 py-7">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-400">
                  Vivi la serata
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Cosa vuoi fare?
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-400">
                  Cambia esperienza in qualsiasi momento.
                </p>


                <button
                  type="button"
                  onClick={() => {
                    setAperto(false)
                    router.push(`/evento/${eventCode}/mio-profilo`)
                  }}
                  className={`mt-6 flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition ${
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
                  className={`mt-3 flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition ${
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

                <div className="mt-8 flex flex-col gap-4">
                  {vociMenu.map((voce, index) => {
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
                        className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition ${
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
                              repeat: attiva ? Infinity : 0,
                              repeatDelay: 2,
                            }}
                            className="flex h-14 w-14 shrink-0 items-center justify-center text-4xl"
                          >
                            {voce.icon}
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
                </div>

                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">
                    Avvisi
                  </p>

                  <button
                    type="button"
                    onClick={cambiaStatoNotifiche}
                    className={`mt-3 flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition ${
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
