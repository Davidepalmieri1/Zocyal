"use client"

import { useEffect, useState } from "react"

export default function NetworkStatus() {
  const [online, setOnline] = useState(true)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)

    function handleOffline() {
      setOnline(false)
      setShowBackOnline(false)
    }

    function handleOnline() {
      setOnline(true)
      setShowBackOnline(true)

      window.setTimeout(() => {
        setShowBackOnline(false)
      }, 3000)
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)

    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  if (!online) {
    return (
      <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-red-500/40 bg-black/95 px-4 py-3 text-center text-sm font-bold text-red-300 shadow-2xl backdrop-blur-xl">
        🔴 Connessione assente. La pagina riprenderà appena torna Internet.
      </div>
    )
  }

  if (showBackOnline) {
    return (
      <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-500/40 bg-black/95 px-4 py-3 text-center text-sm font-bold text-emerald-300 shadow-2xl backdrop-blur-xl">
        🟢 Connessione ripristinata.
      </div>
    )
  }

  return null
}
