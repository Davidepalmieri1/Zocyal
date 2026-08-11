"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

type Coupon = {
  id: string
  coupon_code: string
  event_code: string
  discount_cents: number
  status: string
  coupon_type: "drink" | "reward"
  reward_name?: string
  points_spent?: number
}

type Result =
  | { kind: "coupon"; coupon: Coupon }
  | { kind: "error"; message: string }
  | { kind: "success"; couponCode: string; couponType: "drink" | "reward" }

function statoCoupon(status: string) {
  if (status === "accepted") return "VALIDO"
  if (status === "redeemed") return "GIÀ UTILIZZATO"
  return "NON UTILIZZABILE"
}

export default function BancoPage() {
  const { code: rawCode } = useParams<{ code: string }>()
  const eventCode = rawCode.trim().toLowerCase()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [couponCode, setCouponCode] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState("")

  function nuovoCoupon() {
    setCouponCode("")
    setResult(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function verifica(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = couponCode.replace(/\s+/g, "").toUpperCase()
    await verificaCodice(normalized)
  }

  const verificaCodice = useCallback(async (normalized: string) => {
    if (normalized.length < 4) {
      setResult({ kind: "error", message: "Inserisci il codice completo." })
      return
    }

    setBusy(true)
    setResult(null)
    try {
      const query = new URLSearchParams({
        event_code: eventCode,
        coupon_code: normalized,
      })
      const response = await fetch(`/admin/api/drinks?${query}`, {
        credentials: "same-origin",
        cache: "no-store",
      })
      const body = await response.json()
      if (response.status === 401) {
        window.location.assign(
          `/admin/login?next=${encodeURIComponent(window.location.pathname)}`
        )
        return
      }
      if (!response.ok) throw new Error(body.error || "Coupon non valido.")
      setCouponCode(normalized)
      setResult({ kind: "coupon", coupon: body.coupon })
    } catch (cause) {
      setResult({
        kind: "error",
        message:
          cause instanceof Error ? cause.message : "Verifica non disponibile.",
      })
    } finally {
      setBusy(false)
    }
  }, [eventCode])

  useEffect(() => {
    if (!scannerOpen) return
    let active = true
    let scanner: import("html5-qrcode").Html5Qrcode | null = null

    void import("html5-qrcode").then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (!active) return
      scanner = new Html5Qrcode("coupon-qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (!active) return
            const normalized = decodedText.replace(/\s+/g, "").toUpperCase()
            active = false
            setScannerOpen(false)
            setCouponCode(normalized)
            void verificaCodice(normalized)
          },
          () => undefined
        )
      } catch {
        if (active) setScannerError("Impossibile accedere alla fotocamera. Controlla i permessi del browser oppure inserisci il codice manualmente.")
      }
    })

    return () => {
      active = false
      if (scanner?.isScanning) void scanner.stop().catch(() => undefined)
    }
  }, [scannerOpen, verificaCodice])

  async function usaCoupon(coupon: Coupon) {
    setBusy(true)
    try {
      const response = await fetch("/admin/api/drinks", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, event_code: eventCode, coupon_type: coupon.coupon_type }),
      })
      const body = await response.json()
      if (response.status === 401) {
        window.location.assign(
          `/admin/login?next=${encodeURIComponent(window.location.pathname)}`
        )
        return
      }
      if (!response.ok) throw new Error(body.error || "Convalida non riuscita.")
      setResult({ kind: "success", couponCode: coupon.coupon_code, couponType: coupon.coupon_type })
    } catch (cause) {
      setResult({
        kind: "error",
        message:
          cause instanceof Error ? cause.message : "Convalida non riuscita.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="premium-page min-h-screen px-4 py-5 text-white sm:px-6">
      <PremiumBackdrop />
      <div className="relative mx-auto w-full max-w-lg">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="premium-eyebrow">Modalità staff</p>
            <h1 className="mt-2 text-3xl font-black">Banco e riscatti</h1>
          </div>
          <Link
            href={`/admin/dashboard/${eventCode}`}
            className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black text-white/65"
          >
            DASHBOARD
          </Link>
        </header>

        <section className="premium-glass mt-6 rounded-[2rem] p-5 sm:p-7">
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-3xl">
              ◇
            </span>
            <h2 className="mt-4 text-2xl font-black">Verifica coupon e premi</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Scansiona il QR del cliente oppure digita il codice.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setScannerError("")
              setScannerOpen(true)
            }}
            className="mt-6 w-full rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-black text-black disabled:opacity-50"
          >
            ▣ SCANSIONA QR CODE
          </button>

          <div className="my-5 flex items-center gap-3 text-[10px] font-black uppercase tracking-[.18em] text-white/25">
            <span className="h-px flex-1 bg-white/10" /> oppure <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={verifica}>
            <label
              htmlFor="coupon-code"
              className="mb-2 block text-sm font-black text-white/70"
            >
              Codice coupon
            </label>
            <input
              ref={inputRef}
              id="coupon-code"
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value.toUpperCase())
                setResult(null)
              }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="ESEMPIO: A1B2C3D4"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-5 text-center text-2xl font-black uppercase tracking-[.16em] text-white outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/20 focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/10"
            />
            <button
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-black disabled:opacity-50"
            >
              {busy ? "VERIFICA…" : "VERIFICA COUPON"}
            </button>
          </form>
        </section>

        {scannerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Scansiona coupon">
            <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0b0b0b] p-5">
              <div className="flex items-center justify-between gap-4">
                <div><p className="premium-eyebrow">Fotocamera</p><h2 className="mt-1 text-xl font-black">Inquadra il QR code</h2></div>
                <button type="button" onClick={() => setScannerOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-xl" aria-label="Chiudi scanner">×</button>
              </div>
              <div id="coupon-qr-reader" className="mt-5 overflow-hidden rounded-2xl bg-black" />
              {scannerError && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-4 text-sm leading-6 text-red-200">{scannerError}</p>}
              <p className="mt-4 text-center text-xs leading-5 text-white/40">La verifica parte automaticamente appena il codice viene letto.</p>
            </div>
          </div>
        )}

        {result?.kind === "coupon" && (
          <section
            aria-live="polite"
            className={`mt-4 rounded-[2rem] border p-6 text-center ${
              result.coupon.status === "accepted"
                ? "border-emerald-400/30 bg-emerald-400/10"
                : "border-amber-300/25 bg-amber-300/[.08]"
            }`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[.18em] ${
                result.coupon.status === "accepted"
                  ? "text-emerald-300"
                  : "text-amber-200"
              }`}
            >
              {statoCoupon(result.coupon.status)}
            </p>
            <p className="mt-3 text-3xl font-black tracking-[.16em]">
              {result.coupon.coupon_code}
            </p>
            {result.coupon.reward_name && <p className="mt-3 text-lg font-black text-emerald-200">{result.coupon.reward_name}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/35">
                  {result.coupon.coupon_type === "reward" ? "Punti usati" : "Sconto"}
                </p>
                <p className="mt-1 text-xl font-black">
                  {result.coupon.coupon_type === "reward" ? `${result.coupon.points_spent ?? 0} pt` : (result.coupon.discount_cents / 100).toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </p>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/35">
                  Evento
                </p>
                <p className="mt-1 truncate text-xl font-black uppercase">
                  {result.coupon.event_code}
                </p>
              </div>
            </div>
            {result.coupon.status === "accepted" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void usaCoupon(result.coupon)}
                className="mt-5 w-full rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-black text-black disabled:opacity-50"
              >
                {busy ? "CONFERMO…" : result.coupon.coupon_type === "reward" ? "CONSEGNA PREMIO E SEGNA UTILIZZATO" : "CONFERMA SCONTO E SEGNA UTILIZZATO"}
              </button>
            ) : (
              <button
                type="button"
                onClick={nuovoCoupon}
                className="mt-5 w-full rounded-2xl border border-white/10 px-5 py-4 text-sm font-black"
              >
                VERIFICA UN ALTRO CODICE
              </button>
            )}
          </section>
        )}

        {result?.kind === "success" && (
          <section
            role="status"
            className="mt-4 rounded-[2rem] border border-emerald-400/30 bg-emerald-400/10 p-7 text-center"
          >
            <p className="text-5xl">✓</p>
            <h2 className="mt-3 text-2xl font-black">{result.couponType === "reward" ? "Premio consegnato" : "Coupon utilizzato"}</h2>
            <p className="mt-2 text-sm text-emerald-100/70">
              {result.couponType === "reward" ? "Consegna registrata" : "Sconto registrato"} per {result.couponCode}.
            </p>
            <button
              type="button"
              onClick={nuovoCoupon}
              className="mt-5 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-black"
            >
              VERIFICA IL PROSSIMO
            </button>
          </section>
        )}

        {result?.kind === "error" && (
          <section
            role="alert"
            className="mt-4 rounded-[2rem] border border-red-400/25 bg-red-400/10 p-6 text-center"
          >
            <p className="text-4xl">!</p>
            <h2 className="mt-2 text-xl font-black">Coupon non valido</h2>
            <p className="mt-2 text-sm leading-6 text-red-100/70">
              {result.message}
            </p>
            <button
              type="button"
              onClick={nuovoCoupon}
              className="mt-5 w-full rounded-2xl border border-white/10 px-5 py-4 text-sm font-black"
            >
              RIPROVA
            </button>
          </section>
        )}
      </div>
    </main>
  )
}
