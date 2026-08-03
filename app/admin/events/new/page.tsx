"use client"

import { ChangeEvent, FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"

function iso(value: string) {
  return value ? new Date(value).toISOString() : null
}

export default function NewEventPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [logoPreview, setLogoPreview] = useState("")
  const [posterPreview, setPosterPreview] = useState("")

  function preview(event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) {
    const file = event.currentTarget.files?.[0]
    setter(file ? URL.createObjectURL(file) : "")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const form = new FormData(event.currentTarget)
    form.set("starts_at", iso(String(form.get("starts_at") || "")) || "")
    form.set("ends_at", iso(String(form.get("ends_at") || "")) || "")
    form.set("timezone", "Europe/Rome")

    try {
      const response = await fetch("/admin/api/settings", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Creazione non riuscita.")
      router.push(`/admin/impostazioni/${data.event.code}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore inatteso.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Logo size="medium" />
          <button onClick={() => router.back()} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black">INDIETRO</button>
        </div>
        <p className="mt-10 text-xs font-black uppercase tracking-[.2em] text-pink-400">Nuovo progetto</p>
        <h1 className="mt-2 text-4xl font-black">Crea un nuovo evento</h1>
        <p className="mt-3 text-zinc-400">Nascerà in modalità Bozza, senza partecipanti, chat, missioni o dati di test.</p>
        {error && <p className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}

        <form onSubmit={submit} className="mt-7 grid gap-5 rounded-3xl border border-white/10 bg-white/[.05] p-6">
          <label className="text-sm font-bold">Nome evento<input name="name" required minLength={3} placeholder="Es. Zocyal Summer Party" className="mt-2 w-full rounded-xl bg-white p-4 text-black" /></label>
          <label className="text-sm font-bold">Codice partecipazione<input name="code" required minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_-]{2,23}" placeholder="es. summer26" onInput={(event) => event.currentTarget.value = event.currentTarget.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")} className="mt-2 w-full rounded-xl bg-white p-4 text-black" /></label>
          <p className="-mt-3 text-xs text-zinc-500">Minuscole, numeri, trattino o underscore. Diventerà parte del link e del QR.</p>

          <fieldset className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <legend className="px-2 text-sm font-black">Tipo di esperienza</legend>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Sceglilo ora: resterà collegato a questo evento.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/[.04] p-4 has-[:checked]:border-pink-400/60 has-[:checked]:bg-pink-400/10">
                <input type="radio" name="experience_mode" value="standard" defaultChecked className="accent-pink-500" />
                <span className="ml-2 font-black">Evento standard</span>
                <span className="mt-2 block text-xs leading-5 text-zinc-400">Esperienza Zocyal classica.</span>
              </label>
              <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/[.04] p-4 has-[:checked]:border-pink-400/60 has-[:checked]:bg-pink-400/10">
                <input type="radio" name="experience_mode" value="inclusive" className="accent-pink-500" />
                <span className="ml-2 font-black">Evento inclusivo</span>
                <span className="mt-2 block text-xs leading-5 text-zinc-400">Esperienza progettata per accogliere modalità di partecipazione e matching più inclusive.</span>
              </label>
            </div>
          </fieldset>

          <label className="text-sm font-bold">Luogo<input name="venue" placeholder="Nome locale e città" className="mt-2 w-full rounded-xl bg-white p-4 text-black" /></label>
          <label className="text-sm font-bold">Descrizione<textarea name="description" rows={4} placeholder="Presentazione breve per i partecipanti" className="mt-2 w-full rounded-xl bg-white p-4 text-black" /></label>
          <fieldset className="rounded-[1.75rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/[.08] to-orange-400/[.03] p-5">
            <legend className="px-2 text-sm font-black">Immagine del locale</legend>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Logo e locandina appariranno nell’ingresso digitale della serata e nel centro di controllo amministratore.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="cursor-pointer rounded-2xl border border-dashed border-white/20 bg-black/25 p-4 transition hover:border-pink-400/60">
                <span className="text-xs font-black uppercase tracking-[.14em] text-pink-300">Logo del locale</span>
                <span className="mt-1 block text-xs text-zinc-500">JPG, PNG o WebP · max 3 MB</span>
                <input name="venue_logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => preview(event, setLogoPreview)} className="mt-4 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:font-black file:text-black" />
                {logoPreview && <img src={logoPreview} alt="Anteprima logo" className="mt-4 h-28 w-full rounded-xl border border-white/15 bg-gradient-to-br from-zinc-700 to-black object-contain p-3" />}
              </label>
              <label className="cursor-pointer rounded-2xl border border-dashed border-white/20 bg-black/25 p-4 transition hover:border-orange-300/60">
                <span className="text-xs font-black uppercase tracking-[.14em] text-orange-200">Locandina della serata</span>
                <span className="mt-1 block text-xs text-zinc-500">Formato verticale consigliato · max 8 MB</span>
                <input name="venue_poster" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => preview(event, setPosterPreview)} className="mt-4 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:font-black file:text-black" />
                {posterPreview && <img src={posterPreview} alt="Anteprima locandina" className="mt-4 aspect-[3/4] w-full rounded-xl object-cover" />}
              </label>
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Apertura<input name="starts_at" type="datetime-local" className="mt-2 w-full rounded-xl bg-white p-4 text-black" /></label>
            <label className="text-sm font-bold">Chiusura<input name="ends_at" type="datetime-local" className="mt-2 w-full rounded-xl bg-white p-4 text-black" /></label>
          </div>
          <button disabled={busy} className="mt-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 text-lg font-black disabled:opacity-60">{busy ? "CREAZIONE..." : "CREA EVENTO IN BOZZA"}</button>
        </form>
      </div>
    </main>
  )
}
