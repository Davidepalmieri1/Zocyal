"use client"

import { FormEvent, useState } from "react"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

export default function AdminLoginPage() {
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
      const correctedPath = requestedPath.replace(
        "/admin/dashoboard",
        "/admin/dashboard"
      )
      const destination =
        correctedPath.startsWith("/admin/") &&
        !correctedPath.startsWith("/admin/login")
          ? correctedPath
          : "/admin/events"

      // A full navigation makes the browser send the freshly-created
      // HttpOnly cookie before the protected admin page is requested.
      window.location.assign(destination)
    } catch {
      setError("Connessione non disponibile. Riprova.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="premium-page flex min-h-screen items-center justify-center px-6 py-10 text-white">
      <PremiumBackdrop />
      <div className="premium-glass premium-enter relative w-full max-w-md rounded-[2.25rem] p-7 sm:p-9">
        <Logo size="medium" />
        <p className="premium-eyebrow mt-8">
          Area riservata
        </p>
        <h1 className="premium-title mt-3 text-4xl font-black">Accesso<br />amministratore</h1>
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
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none transition focus:border-pink-400/60 focus:bg-white/[.06] focus:ring-4 focus:ring-pink-500/10"
          />

          {error && (
            <p role="alert" className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="premium-cta mt-6 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-5 py-4 text-sm font-black uppercase tracking-[.12em] text-white disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "ACCESSO IN CORSO..." : "ENTRA"}
          </button>
        </form>
      </div>
    </main>
  )
}
