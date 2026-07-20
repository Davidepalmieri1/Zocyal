"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
import { useState } from "react"
import Logo from "@/app/components/Logo"

type MenuItem = {
  name: string
  icon: string
  path: string
  description: string
}

const menu: MenuItem[] = [
  {
    name: "Dashboard",
    icon: "📊",
    path: "dashboard",
    description: "Panoramica evento",
  },
  {
    name: "Partecipanti",
    icon: "👥",
    path: "partecipanti",
    description: "Persone presenti",
  },
  {
    name: "Match",
    icon: "❤️",
    path: "match",
    description: "Connessioni create",
  },
  {
    name: "Chat",
    icon: "💬",
    path: "chat",
    description: "Conversazioni",
  },
  {
    name: "Premi",
    icon: "🎁",
    path: "premi",
    description: "Missioni e ricompense",
  },
  {
    name: "Analytics",
    icon: "📈",
    path: "analytics",
    description: "Dati e andamento",
  },
  {
    name: "Impostazioni",
    icon: "⚙️",
    path: "impostazioni",
    description: "Gestione evento",
  },
]

export default function Sidebar() {
  const params = useParams<{ code: string }>()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const code = params.code

  function itemLink(item: MenuItem) {
    return item.path === "dashboard"
      ? `/admin/dashboard/${code}`
      : `/admin/${item.path}/${code}`
  }

  function isActive(item: MenuItem) {
    return item.path === "dashboard"
      ? pathname === `/admin/dashboard/${code}`
      : pathname.includes(`/admin/${item.path}/`)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Apri menu amministratore"
        aria-expanded={mobileOpen}
        aria-controls="admin-mobile-menu"
        onClick={() => setMobileOpen(true)}
        className="premium-glass fixed left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl text-white lg:hidden"
      >
        ☰
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Chiudi menu amministratore"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          <motion.aside
            id="admin-mobile-menu"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            className="relative flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto border-r border-white/10 bg-[#09060b]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Logo size="small" />
                <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-pink-400">
                  Evento {code}
                </p>
                <Link href="/admin/events" onClick={()=>setMobileOpen(false)} className="mt-3 inline-flex rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black text-zinc-300">CAMBIA EVENTO</Link>
              </div>
              <div className="flex gap-2">
                <form action="/admin/api/logout" method="post">
                  <button
                    type="submit"
                    className="h-10 rounded-xl border border-pink-400/30 bg-pink-500/10 px-3 text-xs font-black text-pink-200"
                  >
                    ESCI
                  </button>
                </form>
                <button
                  type="button"
                  aria-label="Chiudi menu"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-xl"
                >
                  ×
                </button>
              </div>
            </div>

            <nav className="mt-7 flex flex-1 flex-col gap-2">
              {menu.map((item) => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.name}
                    href={itemLink(item)}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      active
                        ? "border-pink-400/40 bg-pink-500/15 text-pink-200"
                        : "border-white/5 bg-white/[0.03] text-white"
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-black">{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            <form action="/admin/api/logout" method="post" className="mt-6">
              <button className="w-full rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black">
                ESCI DALL&apos;AREA ADMIN
              </button>
            </form>
          </motion.aside>
        </div>
      )}

      <motion.aside
      initial={{
        x: -60,
        opacity: 0,
      }}
      animate={{
        x: 0,
        opacity: 1,
      }}
      transition={{
        duration: 0.45,
      }}
      className="relative hidden min-h-screen w-72 shrink-0 overflow-hidden border-r border-white/[.075] bg-[#08050a]/90 px-5 py-5 text-white backdrop-blur-2xl lg:flex lg:flex-col"
    >
      <div className="pointer-events-none absolute left-[-120px] top-[-100px] h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[100px]" />

      <div className="pointer-events-none absolute bottom-[-120px] right-[-120px] h-72 w-72 rounded-full bg-orange-500/10 blur-[100px]" />

      <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <Logo size="small" />
          <form action="/admin/api/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-2 text-[10px] font-black text-pink-200 transition hover:bg-pink-500/20"
            >
              ESCI
            </button>
          </form>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-400">
            Pannello amministratore
          </p>

          <p className="mt-2 text-sm font-bold text-white">
            Evento {code}
          </p>
          <Link href="/admin/events" className="mt-3 inline-flex rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black text-zinc-300">CAMBIA EVENTO</Link>
        </div>
      </div>

      <nav className="relative mt-5 flex flex-1 flex-col gap-2">
        {menu.map((item, index) => {
          const link = itemLink(item)
          const active = isActive(item)

          return (
            <motion.div
              key={item.name}
              initial={{
                opacity: 0,
                x: -18,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: 0.05 + index * 0.05,
              }}
            >
              <Link
                href={link}
                className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 transition ${
                  active
                    ? "border-pink-400/40 bg-gradient-to-r from-fuchsia-600/20 via-pink-500/15 to-orange-400/10 shadow-[0_12px_35px_rgba(236,72,153,0.12)]"
                    : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.05]"
                }`}
              >
                {active && (
                  <span className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-fuchsia-500 via-pink-500 to-orange-400" />
                )}

                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl transition ${
                    active
                      ? "bg-pink-500/15"
                      : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                  }`}
                >
                  {item.icon}
                </span>

                <span className="min-w-0">
                  <span
                    className={`block text-sm font-black ${
                      active
                        ? "text-pink-300"
                        : "text-white"
                    }`}
                  >
                    {item.name}
                  </span>

                  <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                    {item.description}
                  </span>
                </span>

                <span
                  className={`ml-auto text-xl transition ${
                    active
                      ? "text-pink-300"
                      : "text-white/15 group-hover:translate-x-1 group-hover:text-pink-300"
                  }`}
                >
                  ›
                </span>
              </Link>
            </motion.div>
          )
        })}
      </nav>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <p className="text-xs font-black text-white">
          Zocyal Admin
        </p>

        <p className="mt-1 text-[11px] text-gray-500">
          Centro di controllo premium
        </p>

        <form action="/admin/api/logout" method="post" className="mt-4">
          <button className="w-full rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-black text-gray-300 transition hover:border-pink-400/40 hover:text-white">
            ESCI
          </button>
        </form>
      </div>
      </motion.aside>
    </>
  )
}
