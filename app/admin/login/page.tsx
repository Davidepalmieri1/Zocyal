"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(result.error || "Accesso non riuscito.")
        return
      }

      const requestedPath =
        new URLSearchParams(window.location.search).get("next") ||
        "/admin/events"
      const destination =
        requestedPath.startsWith("/admin/") &&
        !requestedPath.startsWith("/admin/login")
          ? requestedPath
          : "/admin/events"

      router.replace(destination)
      router.refresh()
    } catch {
      setError("Connessione non disponibile. Riprova.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.055] p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <Logo size="medium" />
        <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-pink-400">
          Area riservata
        </p>
        <h1 className="mt-3 text-3xl font-black">Accesso amministratore</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          Inserisci la password organizzatore per gestire l&apos;evento.
        </p>

        <form className="mt-8" onSubmit={login}>
          <label htmlFor="admin-password" className="text-sm font-bold text-gray-200">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20"
          />

          {error && (
            <p role="alert" className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-5 py-4 font-black text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "ACCESSO IN CORSO..." : "ENTRA"}
          </button>
        </form>
      </div>
    </main>
  )
}
