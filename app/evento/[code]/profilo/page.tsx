"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { publicSupabase, supabase } from "@/lib/supabase"
import {
  createParticipantProfile,
  ensureAnonymousSession,
  participantErrorMessage,
} from "@/app/lib/participant-session"
import Logo from "@/app/components/Logo"

const inclusiveOptions = [
  { value: "woman", label: "Donne" },
  { value: "man", label: "Uomini" },
  { value: "non_binary", label: "Persone non binarie" },
  { value: "other", label: "Altre identità" },
]

type RegistrationAvailability = {
  capacity: number
  participants: number
  remaining: number
  available: boolean
}

export default function ProfiloPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [goal, setGoal] = useState("")
  const [eventMode, setEventMode] = useState<"standard" | "inclusive" | "caribbean" | null>(null)
  const [identityCategory, setIdentityCategory] = useState("")
  const [pronouns, setPronouns] = useState("")
  const [connectionPreferences, setConnectionPreferences] = useState<string[]>([])
  const [matchingConsent, setMatchingConsent] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState("")
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState("")
  const [registrationAvailability, setRegistrationAvailability] =
    useState<RegistrationAvailability | null>(null)

  useEffect(() => {
    const eventCode = params.code.trim().toLowerCase()
    void Promise.all([
      publicSupabase
        .from("events")
        .select("experience_mode,status,starts_at,ends_at")
        .eq("code", eventCode)
        .maybeSingle(),
      publicSupabase.rpc("get_event_registration_availability", {
        p_event_code: eventCode,
      }),
    ]).then(([eventResult, availabilityResult]) => {
        if (
          eventResult.error ||
          !eventResult.data ||
          availabilityResult.error ||
          !availabilityResult.data
        ) {
          console.error("Errore configurazione evento:", {
            event: eventResult.error,
            availability: availabilityResult.error,
          })
          setErrore("Non siamo riusciti a caricare la configurazione dell’evento.")
          return
        }

        if (eventResult.data.status !== "open") {
          setErrore(
            eventResult.data.status === "draft"
              ? "L’evento non è ancora aperto. Chiedi allo staff di attivare gli ingressi."
              : "L’evento è terminato e non accetta più nuovi partecipanti."
          )
          return
        }

        const now = Date.now()
        const startsAt = eventResult.data.starts_at
          ? new Date(eventResult.data.starts_at).getTime()
          : null
        const endsAt = eventResult.data.ends_at
          ? new Date(eventResult.data.ends_at).getTime()
          : null

        if (startsAt && startsAt > now) {
          setErrore("L’evento non è ancora iniziato. Riprova all’orario indicato dallo staff.")
          return
        }

        if (endsAt && endsAt <= now) {
          setErrore("L’evento è terminato e non accetta più nuovi partecipanti.")
          return
        }

        setEventMode(eventResult.data.experience_mode === "inclusive" ? "inclusive" : eventResult.data.experience_mode === "caribbean" ? "caribbean" : "standard")
        setRegistrationAvailability(
          availabilityResult.data as RegistrationAvailability
        )
      })
  }, [params.code])

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  function selezionaFoto(file: File | null) {
    setErrore("")

    if (!file) return

    if (!file.type.startsWith("image/")) {
      setErrore("Seleziona un’immagine valida.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrore("La foto non può superare 5 MB.")
      return
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function rimuoviFoto() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    setPhoto(null)
    setPhotoPreview("")
    setErrore("")
  }

  async function salvaProfilo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nicknamePulito = nickname.trim()
    const eta = Number(age)
    const eventCode = params.code.trim().toLowerCase()

    if (registrationAvailability && !registrationAvailability.available) {
      setErrore(
        "Ci dispiace, l'evento ha raggiunto il numero massimo di partecipanti e non è possibile creare un nuovo profilo."
      )
      return
    }

    if (nicknamePulito.length < 2) {
      setErrore("Inserisci un nome o soprannome valido.")
      return
    }

    if (!Number.isInteger(eta) || eta < 18 || eta > 99) {
      setErrore("Inserisci un’età valida. Devi avere almeno 18 anni.")
      return
    }

    if ((eventMode === "standard" || eventMode === "caribbean") && !gender) {
      setErrore("Seleziona il tuo genere.")
      return
    }

    if (!goal) {
      setErrore("Seleziona l’obiettivo della serata.")
      return
    }

    if (!eventMode) {
      setErrore("Attendi il caricamento della configurazione dell’evento.")
      return
    }

    const haCompilatoPreferenzePrivate = Boolean(
      identityCategory || pronouns.trim() || connectionPreferences.length > 0
    )

    if (
      eventMode === "inclusive" &&
      haCompilatoPreferenzePrivate &&
      !matchingConsent
    ) {
      setErrore(
        "Hai compilato le preferenze private, ma non hai autorizzato il loro utilizzo per ordinare i suggerimenti. Spunta il consenso oppure rimuovi le scelte: potrai comunque mettere like a tutti."
      )
      return
    }

    if (
      eventMode === "inclusive" &&
      matchingConsent &&
      (!identityCategory || connectionPreferences.length === 0)
    ) {
      setErrore(
        "Per usare i match inclusivi, indica una categoria e almeno una preferenza di connessione."
      )
      return
    }

    setLoading(true)
    setErrore("")

    let avatarUrl = ""
    let uploadedAvatarPath = ""

    try {
      await ensureAnonymousSession()
    } catch (sessionError) {
      console.error("Errore sessione partecipante:", sessionError)
      setErrore(participantErrorMessage(sessionError))
      setLoading(false)
      return
    }

    if (photo) {
      const estensione =
        photo.name.split(".").pop()?.toLowerCase() || "jpg"

      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id

      if (!userId) {
        setErrore("Sessione partecipante non disponibile.")
        setLoading(false)
        return
      }

      const fileName = `${userId}/${eventCode}/${crypto.randomUUID()}.${estensione}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, photo, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Errore caricamento foto:", uploadError)
        setErrore("Errore durante il caricamento della foto.")
        setLoading(false)
        return
      }

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName)

      avatarUrl = data.publicUrl
      uploadedAvatarPath = fileName
    }

    try {
      await createParticipantProfile({
        eventCode,
        nickname: nicknamePulito,
        age: eta,
        gender,
        goal,
        avatarUrl,
        inclusivePreferences: eventMode === "inclusive" ? {
          identityCategory,
          pronouns: pronouns.trim(),
          connectionPreferences,
          consent: matchingConsent,
        } : undefined,
      })
    } catch (profileError) {
      console.error("Errore salvataggio profilo:", profileError)

      if (uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage
          .from("avatars")
          .remove([uploadedAvatarPath])

        if (cleanupError) {
          console.error("Errore pulizia foto profilo:", cleanupError)
        }
      }

      setErrore(participantErrorMessage(profileError))
      setLoading(false)
      return
    }

    router.push(`/evento/${eventCode}/codice-accesso`)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            Primo passo
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Crea il tuo profilo
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Inserisci i tuoi dati per entrare nella serata.
          </p>
        </div>

        {!registrationAvailability ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 text-center backdrop-blur-xl">
            {errore ? (
              <p className="text-sm leading-6 text-red-300">{errore}</p>
            ) : (
              <>
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />
                <p className="mt-4 text-sm text-gray-400">Verifica dei posti disponibili…</p>
              </>
            )}
          </section>
        ) : !registrationAvailability.available ? (
          <section className="mt-8 rounded-[2rem] border border-orange-300/25 bg-orange-300/[0.08] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <span className="text-5xl" aria-hidden="true">🙏</span>
            <h2 className="mt-5 text-2xl font-black">Evento al completo</h2>
            <p className="mt-3 leading-7 text-gray-300">
              Ci dispiace, abbiamo raggiunto il numero massimo di 190 partecipanti. Al momento non è possibile creare un nuovo profilo per questa serata.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Se avevi già creato il tuo profilo, puoi continuare recuperando il tuo accesso personale.
            </p>
            <Link
              href={`/evento/${params.code}/recupera`}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border border-pink-400/35 bg-pink-500/10 px-6 py-3 font-black text-pink-100 transition hover:bg-pink-500/20"
            >
              RECUPERA IL MIO PROFILO
            </Link>
          </section>
        ) : (
        <form
          onSubmit={salvaProfilo}
          className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 opacity-60 blur-xl" />

              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-950 shadow-2xl">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt="Anteprima foto profilo"
                    width={112}
                    height={112}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">📸</span>
                )}
              </div>
            </div>

            <div className="mt-7 grid w-full gap-3">
              <label
                htmlFor="selfie-photo"
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-pink-400/30 bg-gradient-to-r from-fuchsia-600/20 via-pink-500/15 to-orange-400/10 p-[1px] shadow-[0_16px_45px_rgba(236,72,153,0.15)] transition duration-300 hover:-translate-y-0.5 hover:border-pink-400/60"
              >
                <div className="flex min-h-20 items-center justify-between rounded-[15px] bg-zinc-950/90 px-5 py-4 backdrop-blur-xl">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center text-3xl">
                      🤳
                    </div>

                    <div className="text-left">
                      <p className="text-sm font-black tracking-wide text-white">
                        Scatta un selfie
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Usa subito la fotocamera frontale
                      </p>
                    </div>
                  </div>

                  <span className="ml-3 text-2xl text-white/30 transition duration-300 group-hover:translate-x-1 group-hover:text-pink-300">
                    ›
                  </span>
                </div>
              </label>

              <input
                id="selfie-photo"
                type="file"
                accept="image/*"
                capture="user"
                onChange={(event) => {
                  selezionaFoto(event.target.files?.[0] || null)
                  event.target.value = ""
                }}
                className="hidden"
              />

              <label
                htmlFor="gallery-photo"
                className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 shadow-[0_16px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.065]"
              >
                <div className="flex min-h-12 items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center text-3xl">
                      🖼️
                    </div>

                    <div className="text-left">
                      <p className="text-sm font-black tracking-wide text-white">
                        Scegli dalla galleria
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Carica una foto già presente
                      </p>
                    </div>
                  </div>

                  <span className="ml-3 text-2xl text-white/30 transition duration-300 group-hover:translate-x-1 group-hover:text-white">
                    ›
                  </span>
                </div>
              </label>

              <input
                id="gallery-photo"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  selezionaFoto(event.target.files?.[0] || null)
                  event.target.value = ""
                }}
                className="hidden"
              />
            </div>

            {photo && (
              <div className="mt-4 flex w-full items-center justify-between rounded-2xl border border-green-400/20 bg-green-400/[0.07] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-green-300">
                    Foto pronta
                  </p>

                  <p className="mt-1 max-w-[220px] truncate text-xs text-gray-400">
                    {photo.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={rimuoviFoto}
                  className="ml-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-gray-300 transition hover:border-red-400/40 hover:text-red-300"
                >
                  Rimuovi
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-gray-500">
              Foto facoltativa, massimo 5 MB
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-5">
            <div>
              <label
                htmlFor="nickname"
                className="mb-2 block text-sm font-bold text-gray-300"
              >
                Nome o soprannome
              </label>

              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value)
                  setErrore("")
                }}
                placeholder="Come vuoi farti chiamare?"
                maxLength={30}
                className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 font-semibold text-black outline-none transition placeholder:text-gray-400 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="age"
                className="mb-2 block text-sm font-bold text-gray-300"
              >
                Età
              </label>

              <input
                id="age"
                type="number"
                value={age}
                onChange={(event) => {
                  setAge(event.target.value)
                  setErrore("")
                }}
                placeholder="La tua età"
                min={18}
                max={99}
                inputMode="numeric"
                className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 font-semibold text-black outline-none transition placeholder:text-gray-400 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20"
              />
            </div>

            {(eventMode === "standard" || eventMode === "caribbean") && (
              <div>
                <label htmlFor="gender" className="mb-2 block text-sm font-bold text-gray-300">
                  Genere
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(event) => {
                    setGender(event.target.value)
                    setErrore("")
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 font-semibold text-black outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20"
                >
                  <option value="">Seleziona</option>
                  <option value="Uomo">Uomo</option>
                  <option value="Donna">Donna</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>
            )}

            {eventMode === "inclusive" && (
              <fieldset className="rounded-3xl border border-pink-400/20 bg-pink-400/[0.06] p-5">
                <legend className="px-2 text-sm font-black text-pink-200">Preferenze private per i match</legend>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  Completa i due passaggi: la tua categoria e chi desideri conoscere. Queste informazioni non appariranno sul tuo profilo.
                </p>

                <label className="mt-5 block text-sm font-bold text-gray-300">
                  1. La tua categoria
                  <select value={identityCategory} onChange={(event) => setIdentityCategory(event.target.value)} className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-black">
                    <option value="">Preferisco non indicarla</option>
                    <option value="woman">Donna</option>
                    <option value="man">Uomo</option>
                    <option value="non_binary">Persona non binaria</option>
                    <option value="other">Altra identità</option>
                  </select>
                </label>

                <label className="mt-4 block text-sm font-bold text-gray-300">
                  Pronomi o preferenza di riferimento <span className="font-normal text-gray-500">(facoltativi)</span>
                  <input value={pronouns} onChange={(event) => setPronouns(event.target.value)} maxLength={40} placeholder="Es. lei, lui, loro o il tuo nome" className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-black" />
                </label>

                <div className="mt-5">
                  <p className="text-sm font-bold text-gray-300">2. Chi vorresti incontrare più facilmente?</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {matchingConsent
                      ? "Scegli almeno un’opzione per attivare i match."
                      : "Puoi scegliere più opzioni."}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {inclusiveOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={connectionPreferences.includes(option.value)}
                          onChange={(event) => setConnectionPreferences((current) => event.target.checked ? [...current, option.value] : current.filter((value) => value !== option.value))}
                          className="h-4 w-4 accent-pink-500"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-5 text-gray-300">
                  <input type="checkbox" checked={matchingConsent} onChange={(event) => setMatchingConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-pink-500" />
                  <span>
                    3. Personalizza i suggerimenti. Acconsento all&apos;uso di queste preferenze private esclusivamente per ordinare i profili suggeriti in questo evento. Non impediranno a nessuno di mostrare interesse, non saranno mostrate ad altri partecipanti o allo staff e saranno eliminate insieme ai miei dati dell&apos;evento.
                  </span>
                </label>
                {matchingConsent && (!identityCategory || connectionPreferences.length === 0) && (
                  <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-3 text-xs leading-5 text-amber-100">
                    Per attivare i match, completa la categoria e scegli almeno una preferenza qui sopra.
                  </p>
                )}
                {!matchingConsent && <p className="mt-3 text-xs leading-5 text-amber-200">Puoi continuare senza consenso e mettere like normalmente. Le preferenze servono solo a personalizzare l&apos;ordine dei suggerimenti.</p>}
              </fieldset>
            )}

            <div>
              <label
                htmlFor="goal"
                className="mb-2 block text-sm font-bold text-gray-300"
              >
                Obiettivo della serata
              </label>

              <select
                id="goal"
                value={goal}
                onChange={(event) => {
                  setGoal(event.target.value)
                  setErrore("")
                }}
                className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 font-semibold text-black outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20"
              >
                <option value="">Scegli un’opzione</option>
                <option value="Divertirmi">🎉 Divertirmi</option>
                <option value="Socializzare">🤝 Socializzare</option>
                <option value="Trovare una connessione">
                  ❤️ Trovare una connessione
                </option>
                <option value="Missioni e premi">
                  🎯 Missioni e premi
                </option>
              </select>
            </div>
          </div>

          {errore && (
            <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
              {errore}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-lg font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "CREAZIONE PROFILO..." : "CONTINUA"}
          </button>

          <p className="mt-4 text-center text-xs text-gray-500">
            Partecipando confermi di avere almeno 18 anni.
          </p>
        </form>
        )}
      </div>
    </main>
  )
}
