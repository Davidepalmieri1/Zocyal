"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
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

  const code = params.code

  return (
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
      className="relative hidden min-h-screen w-64 shrink-0 overflow-hidden border-r border-white/10 bg-zinc-950 px-4 py-5 text-white lg:flex lg:flex-col"
    >
      <div className="pointer-events-none absolute left-[-120px] top-[-100px] h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[100px]" />

      <div className="pointer-events-none absolute bottom-[-120px] right-[-120px] h-72 w-72 rounded-full bg-orange-500/10 blur-[100px]" />

      <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <Logo size="small" />

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-400">
            Pannello amministratore
          </p>

          <p className="mt-2 text-sm font-bold text-white">
            Evento {code}
          </p>
        </div>
      </div>

      <nav className="relative mt-5 flex flex-1 flex-col gap-2">
        {menu.map((item, index) => {
          const link =
            item.path === "dashboard"
              ? `/admin/dashboard/${code}`
              : `/admin/${item.path}/${code}`

          const active =
            item.path === "dashboard"
              ? pathname === `/admin/dashboard/${code}`
              : pathname.includes(`/admin/${item.path}/`)

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
      </div>
    </motion.aside>
  )
}
