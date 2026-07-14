"use client"

import { FormEvent, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"

export default function ProfiloPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [goal, setGoal] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState("")
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState("")

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  function selezionaFoto(file: File | null) {
    setErrore("")

    if (!file) {
      return
    }

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

    if (nicknamePulito.length < 2) {
      setErrore("Inserisci un nome o soprannome valido.")
      return
    }

    if (!Number.isInteger(eta) || eta < 18 || eta > 99) {
      setErrore("Inserisci un’età valida. Devi avere almeno 18 anni.")
      return
    }

    if (!gender) {
      setErrore("Seleziona il tuo genere.")
      return
    }

    if (!goal) {
      setErrore("Seleziona l’obiettivo della serata.")
      return
    }

    setLoading(true)
    setErrore("")

    let avatarUrl = ""

    if (photo) {
      const estensione =
        photo.name.split(".").pop()?.toLowerCase() || "jpg"

      const fileName = `${eventCode}/${crypto.randomUUID()}.${estensione}`

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
    }

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({
        event_code: eventCode,
        nickname: nicknamePulito,
        age: eta,
        gender,
        goal,
        avatar_url: avatarUrl,
      })
      .select("id")
      .single()

    if (error) {
      console.error("Errore salvataggio profilo:", error)
      setErrore(error.message)
      setLoading(false)
      return
    }

    localStorage.setItem("participant_id", participant.id)
    localStorage.setItem("event_code", eventCode)

    router.push(`/evento/${eventCode}/questionario`)
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

        <form
          onSubmit={salvaProfilo}
          className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 opacity-60 blur-xl" />

              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-950 shadow-2xl">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Anteprima foto profilo"
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

            <div>
              <label
                htmlFor="gender"
                className="mb-2 block text-sm font-bold text-gray-300"
              >
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
      </div>
    </main>
  )
}