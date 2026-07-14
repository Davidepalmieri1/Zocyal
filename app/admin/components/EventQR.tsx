"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

type EventQRProps = {
  code: string
  name: string
  venue: string
}

export default function EventQR({
  code,
  name,
  venue,
}: EventQRProps) {
  const [url, setUrl] = useState("")

  useEffect(() => {
    if (!code) {
      return
    }

    setUrl(`${window.location.origin}/evento/${code}`)
  }, [code])

  function stampaQR() {
    window.print()
  }

  if (!url) {
    return (
      <div className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-xl">
        <p className="text-black font-bold">Caricamento QR...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-xl">
      <h2 className="text-black text-2xl font-bold mb-2">
        🔥 ZOCYAL
      </h2>

      <h3 className="text-black text-xl font-bold text-center">
        {name}
      </h3>

      <p className="text-gray-600 mt-1">
        📍 {venue}
      </p>

      <div className="mt-6">
        <QRCodeSVG
          value={url}
          size={240}
        />
      </div>

      <p className="text-black mt-6 font-bold text-center">
        📱 Scansiona per partecipare
      </p>

      <p className="text-gray-500 mt-2 text-sm text-center break-all">
        {url}
      </p>

      <button
        type="button"
        onClick={stampaQR}
        className="mt-6 bg-pink-500 text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition"
      >
        🖨️ STAMPA QR
      </button>
    </div>
  )
}