"use client"

import { FormEvent, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import { supabase } from "@/lib/supabase"

const options = [
  { value: "woman", label: "Donne" },
  { value: "man", label: "Uomini" },
  { value: "non_binary", label: "Persone non binarie" },
  { value: "other", label: "Altre identità" },
]

type Settings = {
  inclusive?: boolean
  identity_category?: string | null
  pronouns?: string | null
  connection_preferences?: string[]
  consent?: boolean
  complete?: boolean
}

export default function InclusivePreferencesPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const eventCode = params.code.trim().toLowerCase()
  const [identityCategory, setIdentityCategory] = useState("")
  const [pronouns, setPronouns] = useState("")
  const [preferences, setPreferences] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const participantId = await resolveCurrentParticipant(eventCode)
        if (!participantId) throw new Error("Profilo non trovato.")

        const { data, error: settingsError } = await supabase.rpc(
          "get_inclusive_matching_settings",
          { p_event_code: eventCode }
        )
        if (settingsError) throw settingsError

        const settings = (data || {}) as Settings
        if (!settings.inclusive) {
          router.replace(`/evento/${eventCode}/scegli`)
          return
        }
        setIdentityCategory(settings.identity_category || "")
        setPronouns(settings.pronouns || "")
        setPreferences(settings.connection_preferences || [])
        setConsent(Boolean(settings.consent))
      } catch (cause) {
        console.error("Errore preferenze inclusive:", cause)
        setError(cause instanceof Error ? cause.message : "Impossibile caricare le preferenze.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [eventCode, router])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const hasPrivateChoices = Boolean(
      identityCategory || pronouns.trim() || preferences.length > 0
    )
    if (hasPrivateChoices && !consent) {
      setError("Hai compilato le preferenze private: attiva il consenso per salvarle oppure rimuovi le scelte per continuare senza match inclusivi.")
      return
    }
    if (consent && (!identityCategory || preferences.length === 0)) {
      setError("Per attivare i match inclusivi, indica una categoria e almeno una preferenza di connessione.")
      return
    }

    setSaving(true)
    setError("")
    const { error: saveError } = await supabase.rpc(
      "save_inclusive_matching_settings",
      {
        p_event_code: eventCode,
        p_identity_category: identityCategory || null,
        p_pronouns: pronouns.trim() || null,
        p_connection_preferences: preferences,
        p_consent: consent,
      }
    )
    setSaving(false)

    if (saveError) {
      console.error("Errore salvataggio preferenze inclusive:", saveError)
      setError("Non siamo riusciti a salvare le preferenze.")
      return
    }

    router.push(`/evento/${eventCode}/compatibilita`)
  }

  if (loading) {
    return <main className="premium-page flex min-h-screen items-center justify-center text-white"><div className="text-center"><Logo size="medium" /><p className="mt-6 text-gray-400">Carichiamo le preferenze private…</p></div></main>
  }

  return (
    <main className="premium-page min-h-screen px-5 py-8 text-white">
      <PremiumBackdrop />
      <div className="relative mx-auto max-w-md">
        <Logo size="medium" />
        <p className="premium-eyebrow mt-8">Solo per te</p>
        <h1 className="premium-title mt-3 text-4xl font-black">Preferenze per i match inclusivi</h1>
        <p className="mt-3 leading-7 text-gray-400">Non saranno mostrate nel profilo, agli altri partecipanti o allo staff.</p>

        <form onSubmit={save} className="premium-glass mt-7 rounded-[2rem] p-6">
          <label className="block text-sm font-bold">
            1. La tua categoria <span className="font-normal text-gray-500">(necessaria per attivare i match)</span>
            <select value={identityCategory} onChange={(event) => setIdentityCategory(event.target.value)} className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-black">
              <option value="">Preferisco non indicarla</option>
              <option value="woman">Donna</option>
              <option value="man">Uomo</option>
              <option value="non_binary">Persona non binaria</option>
              <option value="other">Altra identità</option>
            </select>
          </label>

          <label className="mt-5 block text-sm font-bold">
            Pronomi o preferenza di riferimento <span className="font-normal text-gray-500">(facoltativi)</span>
            <input value={pronouns} onChange={(event) => setPronouns(event.target.value)} maxLength={40} placeholder="Es. lei, lui, loro o il tuo nome" className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-black" />
          </label>

          <div className="mt-5">
            <p className="text-sm font-bold">2. Chi desideri conoscere?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <label key={option.value} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={preferences.includes(option.value)}
                    onChange={(event) => setPreferences((current) => event.target.checked ? [...current, option.value] : current.filter((value) => value !== option.value))}
                    className="h-4 w-4 accent-pink-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-pink-400/20 bg-pink-400/[.06] p-4 text-xs leading-5 text-gray-300">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-pink-500" />
            <span>3. Attiva i match inclusivi. Acconsento all&apos;uso di queste preferenze private esclusivamente per filtrare in modo reciproco i possibili match in questo evento. Non saranno mostrate ad altri partecipanti o allo staff e saranno eliminate insieme ai miei dati dell&apos;evento.</span>
          </label>

          {!consent && <p className="mt-3 text-xs leading-5 text-amber-200">Senza consenso non salviamo identità, pronomi o preferenze e la funzione match inclusiva resta disattivata.</p>}
          {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

          <button disabled={saving} className="mt-6 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black disabled:opacity-60">{saving ? "SALVATAGGIO…" : "SALVA E CERCA MATCH"}</button>
        </form>
      </div>
    </main>
  )
}
