"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

export default function EventoPage() {
  const router = useRouter()
  const codeInputRef = useRef<HTMLInputElement | null>(null)

  const [code, setCode] = useState("")
  const [errore, setErrore] = useState("")
  const [guidaQrAperta, setGuidaQrAperta] = useState(false)

  function entraEvento() {
    const codicePulito = code.trim().toLowerCase()

    if (!codicePulito) {
      setErrore("Inserisci il codice della serata.")
      return
    }

    router.push(`/evento/${codicePulito}`)
  }

  function tornaAlCodiceManuale() {
    setGuidaQrAperta(false)
    window.setTimeout(() => codeInputRef.current?.focus(), 0)
  }

  return (
    <main className="premium-page px-5 text-white sm:px-6">
      <PremiumBackdrop />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center py-10 text-center">
        <Logo size="large" />

        <h1 className="sr-only">
          Entra in Zocyal
        </h1>

        <p className="premium-eyebrow premium-enter mt-7">Accesso esperienza</p>
        <h2 className="premium-title premium-enter premium-enter-delay-1 mt-4 text-4xl font-black sm:text-5xl">
          Entra nella serata
        </h2>

        <p className="mt-3 max-w-sm text-base leading-7 text-gray-400">
          Inserisci il codice mostrato dal locale. Se hai un QR, puoi
          inquadrarlo direttamente con la fotocamera del telefono.
        </p>

        <div className="premium-glass premium-enter premium-enter-delay-2 mt-9 w-full rounded-[2rem] p-5 text-left sm:p-7">
          <label
            htmlFor="event-code"
            className="mb-3 block text-left text-sm font-bold text-gray-300"
          >
            Codice evento
          </label>

          <input
            ref={codeInputRef}
            id="event-code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setErrore("")
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                entraEvento()
              }
            }}
            placeholder="Esempio: zocyal01"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl border border-white/10 bg-white/[.075] px-5 py-4 text-center text-lg font-black uppercase tracking-[.15em] text-white outline-none transition placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-white/25 focus:border-pink-400/60 focus:bg-white/[.11] focus:ring-4 focus:ring-pink-500/10"
          />

          {errore && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errore}
            </p>
          )}

          <button
            type="button"
            onClick={entraEvento}
            className="premium-cta mt-5 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-sm font-black uppercase tracking-[.12em] text-white"
          >
            ENTRA NELLA SERATA
          </button>

          <button
            type="button"
            onClick={() => setGuidaQrAperta(true)}
            aria-haspopup="dialog"
            className="mt-3 w-full rounded-full border border-pink-400/30 bg-pink-500/10 px-6 py-4 text-sm font-black uppercase tracking-[.08em] text-white transition hover:border-pink-300/60 hover:bg-pink-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-500/30"
          >
            INQUADRA IL QR CON LA FOTOCAMERA DEL TELEFONO
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-8 text-sm font-semibold text-gray-500 transition hover:text-white"
        >
          Torna alla homepage
        </button>
      </div>

      {guidaQrAperta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guida-qr-titolo"
          aria-describedby="guida-qr-descrizione"
        >
          <div className="premium-glass w-full max-w-md rounded-[2rem] bg-zinc-950/95 p-6 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="text-left">
                <p className="premium-eyebrow">Accesso rapido</p>
                <h2 id="guida-qr-titolo" className="mt-2 text-2xl font-black">
                  Inquadra il QR
                </h2>

                <p
                  id="guida-qr-descrizione"
                  className="mt-2 text-sm leading-6 text-gray-400"
                >
                  Non serve scansionarlo dentro Zocyal.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGuidaQrAperta(false)}
                aria-label="Chiudi la guida QR"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-500/30"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/[.055] p-4">
                <p className="font-black text-white">Su iPhone</p>
                <p className="mt-1 text-sm leading-6 text-gray-300">
                  Apri l&apos;app Fotocamera, inquadra il QR e tocca il link che
                  compare.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.055] p-4">
                <p className="font-black text-white">Su Android</p>
                <p className="mt-1 text-sm leading-6 text-gray-300">
                  Apri Fotocamera o Google Lens, inquadra il QR e tocca il link
                  che compare.
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-sm leading-6 text-gray-400">
              Il link ti porterà direttamente nella serata.
            </p>

            <button
              type="button"
              onClick={tornaAlCodiceManuale}
              className="premium-cta mt-5 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 text-sm font-black uppercase tracking-[.1em] text-white"
            >
              TORNA AL CODICE MANUALE
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
