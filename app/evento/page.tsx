"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Html5QrcodeScanner } from "html5-qrcode"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"

export default function EventoPage() {
  const router = useRouter()
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  const [code, setCode] = useState("")
  const [errore, setErrore] = useState("")
  const [scannerAperto, setScannerAperto] = useState(false)

  function entraEvento() {
    const codicePulito = code.trim().toLowerCase()

    if (!codicePulito) {
      setErrore("Inserisci il codice della serata.")
      return
    }

    router.push(`/evento/${codicePulito}`)
  }

  function estraiCodiceDaQr(testoQr: string) {
    try {
      const url = new URL(testoQr)
      const parti = url.pathname.split("/").filter(Boolean)

      if (parti[0] === "evento" && parti[1]) {
        return parti[1].toLowerCase()
      }
    } catch {
      const testoPulito = testoQr.trim().toLowerCase()

      if (testoPulito && !testoPulito.includes("/")) {
        return testoPulito
      }
    }

    return null
  }

  function apriScanner() {
    setErrore("")
    setScannerAperto(true)
  }

  async function chiudiScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear()
      } catch (error) {
        console.error("Errore chiusura scanner:", error)
      }

      scannerRef.current = null
    }

    setScannerAperto(false)
  }

  useEffect(() => {
    if (!scannerAperto) {
      return
    }

    const scanner = new Html5QrcodeScanner(
      "zocyal-qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 240,
          height: 240,
        },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      false
    )

    scannerRef.current = scanner

    scanner.render(
      async (decodedText) => {
        const codiceEvento = estraiCodiceDaQr(decodedText)

        if (!codiceEvento) {
          setErrore("Il QR scansionato non appartiene a un evento Zocyal.")
          return
        }

        try {
          await scanner.clear()
        } catch {
          // Lo scanner potrebbe essere già stato chiuso.
        }

        scannerRef.current = null
        setScannerAperto(false)
        router.push(`/evento/${codiceEvento}`)
      },
      () => {
        // Gli errori di scansione continui non vengono mostrati.
      }
    )

    return () => {
      scanner
        .clear()
        .catch(() => undefined)

      scannerRef.current = null
    }
  }, [scannerAperto, router])

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
          Inserisci il codice mostrato dal locale oppure scansiona il QR
          dell&apos;evento.
        </p>

        <div className="premium-glass premium-enter premium-enter-delay-2 mt-9 w-full rounded-[2rem] p-5 text-left sm:p-7">
          <label
            htmlFor="event-code"
            className="mb-3 block text-left text-sm font-bold text-gray-300"
          >
            Codice evento
          </label>

          <input
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
            onClick={apriScanner}
            className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.04] px-8 py-4 text-sm font-black uppercase tracking-[.1em] text-white/75 transition hover:border-pink-400/30 hover:bg-pink-500/10 hover:text-white"
          >
            📷 SCANSIONA IL QR
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

      {scannerAperto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-5">
          <div className="premium-glass w-full max-w-md rounded-[2rem] bg-zinc-950/90 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-xl font-black">
                  Scansiona il QR
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Inquadra il codice mostrato dal locale.
                </p>
              </div>

              <button
                type="button"
                onClick={chiudiScanner}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl"
              >
                ×
              </button>
            </div>

            <div
              id="zocyal-qr-reader"
              className="overflow-hidden rounded-2xl bg-white text-black"
            />
          </div>
        </div>
      )}
    </main>
  )
}
