"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"
import Logo from "@/app/components/Logo"

type Profilo = {
  id: string
  nickname: string | null
  age: number | null
  gender: string | null
  goal: string | null
  avatar_url: string | null
  recovery_code?: string | null
}

function avatarStoragePath(avatarUrl: string | null) {
  if (!avatarUrl) return null

  try {
    const marker = "/storage/v1/object/public/avatars/"
    const pathname = new URL(avatarUrl).pathname
    const markerIndex = pathname.indexOf(marker)

    if (markerIndex === -1) return null
    return decodeURIComponent(pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

export default function MioProfiloPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [profilo, setProfilo] = useState<Profilo | null>(null)
  const [inclusiveMode, setInclusiveMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState("")
  const [eliminazioneAperta, setEliminazioneAperta] = useState(false)
  const [confermaEliminazione, setConfermaEliminazione] = useState("")
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false)
  const [erroreEliminazione, setErroreEliminazione] = useState("")

  useEffect(() => {
    async function caricaProfilo() {
      let participantId: string | null = null
      try {
        participantId = await resolveCurrentParticipant(params.code)
        if (!participantId) {
          setErrore("Profilo non trovato.")
          setLoading(false)
          return
        }
      } catch (sessionError) {
        console.error("Errore sessione partecipante:", sessionError)
        setErrore("Sessione partecipante non disponibile.")
        setLoading(false)
        return
      }

      const eventCode = params.code.trim().toLowerCase()

      const { data, error } = await supabase
        .from("participants")
        .select("id, nickname, age, gender, goal, avatar_url")
        .eq("id", participantId)
        .maybeSingle()

      if (error) {
        console.error("Errore caricamento profilo:", error)
        setErrore("Non siamo riusciti a caricare il tuo profilo.")
        setLoading(false)
        return
      }

      if (!data) {
        setErrore("Profilo non trovato.")
        setLoading(false)
        return
      }

      const { data: eventData } = await supabase
        .from("events")
        .select("experience_mode")
        .eq("code", eventCode)
        .maybeSingle()
      setInclusiveMode(eventData?.experience_mode === "inclusive")

      setProfilo({
        ...(data as Profilo),
        recovery_code: localStorage.getItem("recovery_code"),
      })
      setLoading(false)
    }

    void caricaProfilo()
  }, [params.code])

  async function eliminaProfilo() {
    if (!profilo || confermaEliminazione.trim().toUpperCase() !== "ELIMINA") {
      return
    }

    setEliminazioneInCorso(true)
    setErroreEliminazione("")

    const avatarPath = avatarStoragePath(profilo.avatar_url)
    const eventCode = params.code.trim().toLowerCase()
    const { error } = await supabase.rpc("delete_own_participant", {
      p_event_code: eventCode,
      p_confirmation: confermaEliminazione.trim(),
    })

    if (error) {
      console.error("Errore eliminazione profilo:", error)
      setErroreEliminazione(
        "Non siamo riusciti a eliminare il profilo. Riprova o avvisa lo staff."
      )
      setEliminazioneInCorso(false)
      return
    }

    if (avatarPath) {
      const { error: avatarError } = await supabase.storage
        .from("avatars")
        .remove([avatarPath])

      if (avatarError) {
        console.warn("Profilo eliminato, foto non rimossa dallo storage:", avatarError)
      }
    }

    localStorage.removeItem("participant_id")
    localStorage.removeItem("event_code")
    localStorage.removeItem("recovery_code")

    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.warn("Profilo eliminato, sessione locale non chiusa:", signOutError)
    }

    router.replace(`/evento/${params.code}`)
    router.refresh()
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <p className="mt-5 text-gray-400">
            Carichiamo il tuo profilo...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            La tua identità nella serata
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Il mio profilo
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Mostra questa schermata quando incontri qualcuno,
            così potrà riconoscerti subito.
          </p>
        </div>

        {errore ? (
          <div className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-300">{errore}</p>

            <button
              type="button"
              onClick={() =>
                router.push(`/evento/${params.code}/profilo`)
              }
              className="mt-5 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white"
            >
              CREA IL PROFILO
            </button>
          </div>
        ) : (
          profilo && (
            <>
              <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="relative h-96 overflow-hidden bg-zinc-900">
                  {profilo.avatar_url ? (
                    <img
                      src={profilo.avatar_url}
                      alt={profilo.nickname || "Foto profilo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-8xl">👤</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                  <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] backdrop-blur">
                    Profilo Zocyal
                  </div>

                  <div className="absolute bottom-6 left-6 right-6">
                    <h2 className="text-4xl font-black">
                      {profilo.nickname || "Partecipante"}
                    </h2>

                    <p className="mt-2 text-base font-semibold text-gray-300">
                      {profilo.age
                        ? `${profilo.age} anni`
                        : "Età non indicata"}
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid gap-3">
                    {!inclusiveMode && <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-gray-500">
                        Genere
                      </p>

                      <p className="mt-2 font-bold text-white">
                        {profilo.gender || "Non indicato"}
                      </p>
                    </div>}

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-gray-500">
                        Obiettivo della serata
                      </p>

                      <p className="mt-2 font-bold text-white">
                        {profilo.goal || "Non indicato"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-4 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-pink-300">
                      Codice personale
                    </p>

                    <p className="mt-2 break-all font-mono text-lg font-black tracking-[0.1em] text-white sm:text-xl">
                      {profilo.recovery_code || "NON DISPONIBILE"}
                    </p>
                  </div>
                </div>
              </section>

              <button
                type="button"
                onClick={() =>
                  router.push(`/evento/${params.code}/scegli`)
                }
                className="mt-5 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white shadow-[0_0_35px_rgba(236,72,153,0.22)]"
              >
                TORNA ALLA SERATA
              </button>
              {inclusiveMode && (
                <button
                  type="button"
                  onClick={() => router.push(`/evento/${params.code}/preferenze`)}
                  className="mt-3 w-full rounded-full border border-pink-400/30 bg-pink-400/10 px-6 py-4 font-black text-pink-100"
                >
                  GESTISCI PREFERENZE PRIVATE
                </button>
              )}

              <section className="mt-8 rounded-3xl border border-red-500/25 bg-red-500/[0.06] p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">
                  Gestione profilo
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Puoi eliminare definitivamente il tuo profilo e tutti i dati
                  collegati a questa serata.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setErroreEliminazione("")
                    setEliminazioneAperta(true)
                  }}
                  className="mt-4 w-full rounded-full border border-red-400/35 bg-red-500/10 px-6 py-4 font-black text-red-200 transition hover:bg-red-500/20"
                >
                  ELIMINA IL MIO PROFILO
                </button>
              </section>
            </>
          )
        )}
      </div>

      {eliminazioneAperta && profilo && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titolo-eliminazione-profilo"
        >
          <section className="w-full max-w-md rounded-[2rem] border border-red-500/30 bg-zinc-950 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.75)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
              Azione definitiva
            </p>
            <h2
              id="titolo-eliminazione-profilo"
              className="mt-3 text-2xl font-black text-white"
            >
              Eliminare il profilo?
            </h2>
            <p className="mt-3 leading-7 text-gray-300">
              Verranno eliminati profilo, match, chat, punti, missioni, premi e
              inviti di questa serata. Non potrai recuperarli.
            </p>
            <label className="mt-5 block text-sm font-bold text-gray-300">
              Scrivi <span className="text-red-300">ELIMINA</span> per confermare
              <input
                type="text"
                value={confermaEliminazione}
                onChange={(event) => setConfermaEliminazione(event.target.value)}
                disabled={eliminazioneInCorso}
                autoComplete="off"
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-4 font-black uppercase tracking-[0.12em] text-white outline-none transition focus:border-red-400/60"
                placeholder="ELIMINA"
              />
            </label>

            {erroreEliminazione && (
              <p className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
                {erroreEliminazione}
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setEliminazioneAperta(false)
                  setConfermaEliminazione("")
                  setErroreEliminazione("")
                }}
                disabled={eliminazioneInCorso}
                className="rounded-full border border-white/15 px-5 py-4 font-black text-white disabled:opacity-50"
              >
                ANNULLA
              </button>
              <button
                type="button"
                onClick={() => void eliminaProfilo()}
                disabled={
                  eliminazioneInCorso ||
                  confermaEliminazione.trim().toUpperCase() !== "ELIMINA"
                }
                className="rounded-full bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {eliminazioneInCorso ? "ELIMINAZIONE..." : "ELIMINA DEFINITIVAMENTE"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
