"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { resolveCurrentParticipant } from "@/app/lib/participant-session"

const PROFILI_PER_PAGINA = 20
const SOGLIA_COMPATIBILITA_MATCH = 30

type StatoMatch = "match" | "liked" | "received_like" | "none"

type PersonaMatch = {
  id: string
  nickname: string | null
  age: number | null
  avatar_url: string | null
  compatibilita: number
  stato: StatoMatch
  match_id: string | null
}

type Risposte = {
  participant_id: string
  question_1?: string | null
  question_2?: string | null
  question_3?: string | null
  question_4?: string | null
  question_5?: string | null
  question_6?: string | null
  question_7?: string | null
  question_8?: string | null
}

type LikeRecord = {
  id?: string
  from_participant: string
  to_participant: string
}

type MatchRecord = {
  id: string
  user_one: string
  user_two: string
}

export default function CompatibilitaPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [matches, setMatches] = useState<PersonaMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAltri, setLoadingAltri] = useState(false)
  const [haAltriProfili, setHaAltriProfili] = useState(true)
  const [prossimoIndice, setProssimoIndice] = useState(0)
  const [errore, setErrore] = useState("")
  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null)
  const [mioId, setMioId] = useState<string | null>(null)
  const [indiceAttivo, setIndiceAttivo] = useState(0)
  const [inclusiveMode, setInclusiveMode] = useState(false)
  const [inclusiveSetupRequired, setInclusiveSetupRequired] = useState(false)

  const mieRisposteRef = useRef<Risposte | null>(null)
  const likesRef = useRef<LikeRecord[]>([])
  const userMatchesRef = useRef<MatchRecord[]>([])

  function calcolaCompatibilita(a: Risposte, b: Risposte) {
    const domande: Array<keyof Risposte> = [
      "question_1",
      "question_2",
      "question_3",
      "question_4",
      "question_5",
      "question_6",
      "question_7",
      "question_8",
    ]

    let uguali = 0

    domande.forEach((domanda) => {
      if (a[domanda] && b[domanda] && a[domanda] === b[domanda]) {
        uguali++
      }
    })

    return Math.round((uguali / domande.length) * 100)
  }

  function coloreCompatibilita(percentuale: number) {
    if (percentuale >= 75) {
      return "from-fuchsia-500 via-pink-500 to-orange-400"
    }

    if (percentuale >= 50) {
      return "from-violet-500 via-fuchsia-500 to-pink-500"
    }

    return "from-zinc-500 via-zinc-400 to-zinc-300"
  }

  function testoCompatibilita(percentuale: number) {
    if (percentuale >= 75) return "Affinità molto alta"
    if (percentuale >= 50) return "Buona compatibilità"
    return "Potreste sorprendervi"
  }

  function trovaStatoPersona(personId: string, participantId: string) {
    const mioLike = likesRef.current.find(
      (like) =>
        like.from_participant === participantId &&
        like.to_participant === personId
    )

    const ricevutoLike = likesRef.current.find(
      (like) =>
        like.from_participant === personId &&
        like.to_participant === participantId
    )

    const match = userMatchesRef.current.find(
      (item) =>
        (item.user_one === participantId && item.user_two === personId) ||
        (item.user_one === personId && item.user_two === participantId)
    )

    return {
      match_id: match?.id || null,
      stato: match
        ? ("match" as const)
        : mioLike
          ? ("liked" as const)
          : ricevutoLike
            ? ("received_like" as const)
            : ("none" as const),
    }
  }

  async function caricaBloccoProfili(
    participantId: string,
    eventCode: string,
    indiceIniziale: number,
    reset = false
  ) {
    if (reset) {
      setLoading(true)
    } else {
      setLoadingAltri(true)
    }
    setErrore("")

    try {
      let indiceCorrente = indiceIniziale
      let haAltriBlocchi = true
      let nuovePersone: PersonaMatch[] = []

      // Continua sui blocchi successivi se quello corrente non contiene
      // profili sopra soglia, senza nascondere candidati validi più avanti.
      while (nuovePersone.length === 0 && haAltriBlocchi) {
        const indiceFinale = indiceCorrente + PROFILI_PER_PAGINA - 1
        const { data: altriPartecipanti, error: partecipantiError } =
          await supabase
            .from("participants")
            .select("id, nickname, age, avatar_url")
            .neq("id", participantId)
            .eq("event_code", eventCode)
            .eq("completed_test", true)
            .order("created_at", { ascending: true })
            .range(indiceCorrente, indiceFinale)

        if (partecipantiError) {
          console.error("Errore caricamento partecipanti:", partecipantiError)
          setErrore("Non siamo riusciti a caricare le affinità.")
          return 0
        }

        const partecipanti = altriPartecipanti || []
        const participantIds = partecipanti.map((persona) => persona.id)
        const risposteResult =
          participantIds.length > 0
            ? await supabase
                .from("answers")
                .select("*")
                .in("participant_id", participantIds)
            : { data: [] as Risposte[], error: null }

        if (risposteResult.error) {
          console.error(
            "Errore caricamento risposte profili:",
            risposteResult.error
          )
          setErrore("Alcune compatibilità non sono state calcolate.")
        }

        const risposte = (risposteResult.data || []) as Risposte[]
        nuovePersone = partecipanti
          .map((person) => {
            const sueRisposte = risposte.find(
              (answer) => answer.participant_id === person.id
            )
            const compatibilita =
              mieRisposteRef.current && sueRisposte
                ? calcolaCompatibilita(mieRisposteRef.current, sueRisposte)
                : 0

            return {
              ...person,
              compatibilita,
              ...trovaStatoPersona(person.id, participantId),
            } as PersonaMatch
          })
          .filter(
            (person) =>
              person.compatibilita >= SOGLIA_COMPATIBILITA_MATCH
          )

        indiceCorrente += partecipanti.length
        haAltriBlocchi = partecipanti.length === PROFILI_PER_PAGINA
      }

      setMatches((attuali) => {
        const base = reset ? [] : attuali
        const mappa = new Map<string, PersonaMatch>()

        ;[...base, ...nuovePersone].forEach((persona) => {
          mappa.set(persona.id, persona)
        })

        return Array.from(mappa.values()).sort(
          (a, b) => b.compatibilita - a.compatibilita
        )
      })

      setProssimoIndice(indiceCorrente)
      setHaAltriProfili(haAltriBlocchi)
      return nuovePersone.length
    } catch (error) {
      console.error("Errore imprevisto caricamento profili:", error)
      setErrore("Si è verificato un errore durante il caricamento.")
      return 0
    } finally {
      setLoading(false)
      setLoadingAltri(false)
    }
  }

  async function caricaAltriProfili() {
    if (!mioId || loadingAltri || !haAltriProfili) return 0

    return caricaBloccoProfili(
      mioId,
      params.code.trim().toLowerCase(),
      prossimoIndice
    )
  }

  async function vaiAlProssimoProfilo() {
    if (indiceAttivo < matches.length - 1) {
      setIndiceAttivo((indice) => indice + 1)
      return
    }

    if (haAltriProfili && !loadingAltri) {
      const quantiPrima = matches.length
      const caricati = await caricaAltriProfili()
      setIndiceAttivo(caricati > 0 ? quantiPrima : 0)
      return
    }

    setIndiceAttivo(0)
  }

  function vaiAlProfiloPrecedente() {
    setIndiceAttivo((indice) =>
      indice > 0 ? indice - 1 : Math.max(matches.length - 1, 0)
    )
  }

  async function apriChat(person: PersonaMatch) {
    const participantId = mioId

    if (!participantId) {
      setErrore("Profilo non trovato.")
      return
    }

    let matchId = person.match_id

    if (!matchId) {
      const { data: match, error } = await supabase
        .from("matches")
        .select("id")
        .or(
          `and(user_one.eq.${participantId},user_two.eq.${person.id}),and(user_one.eq.${person.id},user_two.eq.${participantId})`
        )
        .maybeSingle()

      if (error) {
        console.error("Errore ricerca match:", error)
        setErrore(error.message)
        return
      }

      matchId = match?.id || null
    }

    if (!matchId) {
      setErrore("Il match non è ancora disponibile.")
      return
    }

    router.push(`/evento/${params.code}/chat/${matchId}`)
  }

  async function inviaInteresse(person: PersonaMatch) {
    if (person.stato !== "none" && person.stato !== "received_like") return

    const participantId = mioId

    if (!participantId) {
      setErrore("Profilo non trovato.")
      return
    }

    setAzioneInCorso(person.id)
    setErrore("")

    try {
      const { data, error: interestError } = await supabase.rpc(
        "send_interest",
        { p_to_participant: person.id }
      )

      if (interestError) {
        if (interestError.message.includes("Inclusive matching preferences required")) {
          setInclusiveSetupRequired(true)
          setErrore("Completa le preferenze private per usare i match inclusivi.")
        } else {
          setErrore(`Errore durante l’invio dell’interesse: ${interestError.message}`)
        }
        return
      }

      const result = (data || {}) as {
        mutual?: boolean
        match_id?: string | null
      }
      const matchId = result.match_id || null

      if (!likesRef.current.some((like) => like.from_participant === participantId && like.to_participant === person.id)) {
        likesRef.current = [
          ...likesRef.current,
          { from_participant: participantId, to_participant: person.id },
        ]
      }

      if (!result.mutual) {
        setMatches((attuali) =>
          attuali.map((persona) =>
            persona.id === person.id
              ? { ...persona, stato: "liked" }
              : persona
          )
        )
        return
      }

      if (!matchId) {
        setErrore("L’interesse è reciproco, ma il match non è ancora disponibile.")
        return
      }

      if (
        matchId &&
        !userMatchesRef.current.some((match) => match.id === matchId)
      ) {
        userMatchesRef.current = [
          ...userMatchesRef.current,
          {
            id: matchId,
            user_one: participantId,
            user_two: person.id,
          },
        ]
      }

      setMatches((attuali) =>
        attuali.map((persona) =>
          persona.id === person.id
            ? { ...persona, stato: "match", match_id: matchId }
            : persona
        )
      )
    } catch (error) {
      console.error("Errore imprevisto durante il match:", error)
      setErrore("Si è verificato un errore imprevisto durante il match.")
    } finally {
      setAzioneInCorso(null)
    }
  }

  useEffect(() => {
    const eventCode = params.code.trim().toLowerCase()

    async function identificaProfilo() {
      try {
        const participantId = await resolveCurrentParticipant(eventCode)
        setMioId(participantId)

        if (!participantId) {
          setErrore("Profilo non trovato. Recuperalo o creane uno nuovo.")
          setLoading(false)
        }
      } catch (cause) {
        console.error("Errore identificazione profilo:", cause)
        setErrore("Non siamo riusciti a riconoscere il profilo attivo.")
        setLoading(false)
      }
    }

    void identificaProfilo()
  }, [params.code])

  useEffect(() => {
    if (!mioId) return

    const eventCode = params.code.trim().toLowerCase()
    const participantId = mioId

    const participantIdSicuro = participantId

    async function inizializzaPagina() {
      setLoading(true)
      setErrore("")
      setMatches([])
      setIndiceAttivo(0)
      setProssimoIndice(0)
      setHaAltriProfili(true)
      setInclusiveSetupRequired(false)

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("experience_mode")
        .eq("code", eventCode)
        .maybeSingle()

      if (eventError || !eventData) {
        setErrore("Non siamo riusciti a caricare la configurazione dell’evento.")
        setLoading(false)
        return
      }

      const isInclusive = eventData.experience_mode === "inclusive"
      setInclusiveMode(isInclusive)

      if (isInclusive) {
        const { data: settingsData, error: settingsError } = await supabase.rpc(
          "get_inclusive_matching_settings",
          { p_event_code: eventCode }
        )

        if (settingsError) {
          setErrore("Non siamo riusciti a verificare le preferenze private.")
          setLoading(false)
          return
        }

        const settings = (settingsData || {}) as { complete?: boolean }
        if (!settings.complete) {
          setInclusiveSetupRequired(true)
          setLoading(false)
          return
        }
      }

      const [risposteResult, likesResult, matchesResult] = await Promise.all([
        supabase
          .from("answers")
          .select("*")
          .eq("participant_id", participantIdSicuro)
          .maybeSingle(),
        supabase
          .from("likes")
          .select("id, from_participant, to_participant")
          .or(
            `from_participant.eq.${participantIdSicuro},to_participant.eq.${participantIdSicuro}`
          ),
        supabase
          .from("matches")
          .select("id, user_one, user_two")
          .or(
            `user_one.eq.${participantIdSicuro},user_two.eq.${participantIdSicuro}`
          ),
      ])

      mieRisposteRef.current = risposteResult.data as Risposte | null
      likesRef.current = (likesResult.data || []) as LikeRecord[]
      userMatchesRef.current = (matchesResult.data || []) as MatchRecord[]

      await caricaBloccoProfili(participantId, eventCode, 0, true)
    }

    inizializzaPagina()

    const channel = supabase
      .channel(`compatibilita-live-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "likes",
          filter: `to_participant=eq.${participantIdSicuro}`,
        },
        (payload) => {
          const nuovoLike = payload.new as LikeRecord

          if (
            !likesRef.current.some(
              (like) =>
                like.from_participant === nuovoLike.from_participant &&
                like.to_participant === nuovoLike.to_participant
            )
          ) {
            likesRef.current = [...likesRef.current, nuovoLike]
          }

          setMatches((attuali) =>
            attuali.map((person) =>
              person.id === nuovoLike.from_participant
                ? {
                    ...person,
                    stato:
                      person.stato === "liked"
                        ? "match"
                        : "received_like",
                  }
                : person
            )
          )
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          const nuovoMatch = payload.new as MatchRecord

          if (
            nuovoMatch.user_one !== participantIdSicuro &&
            nuovoMatch.user_two !== participantIdSicuro
          ) {
            return
          }

          if (
            !userMatchesRef.current.some(
              (match) => match.id === nuovoMatch.id
            )
          ) {
            userMatchesRef.current = [
              ...userMatchesRef.current,
              nuovoMatch,
            ]
          }

          const altroUtente =
            nuovoMatch.user_one === participantIdSicuro
              ? nuovoMatch.user_two
              : nuovoMatch.user_one

          setMatches((attuali) =>
            attuali.map((person) =>
              person.id === altroUtente
                ? {
                    ...person,
                    stato: "match",
                    match_id: nuovoMatch.id,
                  }
                : person
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mioId, params.code])

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <h1 className="mt-6 text-2xl font-black">
            Cerchiamo le affinità migliori
          </h1>

          <p className="mt-3 text-gray-400">
            Carichiamo i primi profili della serata.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="premium-page min-h-screen px-5 py-7 text-white sm:px-6 sm:py-10">
      <PremiumBackdrop orbs={false} />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="premium-eyebrow">
            Le tue affinità
          </p>

          <h1 className="premium-title mt-3 text-4xl font-black">
            Persone compatibili
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            {inclusiveMode
              ? `Mostriamo profili con preferenze reciproche e almeno il ${SOGLIA_COMPATIBILITA_MATCH}% di affinità, senza rendere pubbliche le vostre scelte.`
              : `Mostriamo profili con almeno il ${SOGLIA_COMPATIBILITA_MATCH}% di affinità, caricati a gruppi per mantenere la serata veloce.`}
          </p>

          {matches.length > 0 && (
            <span className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-gray-400">
              {matches.length} profili caricati
            </span>
          )}
        </div>

        {errore && (
          <p className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm leading-6 text-red-300">
            {errore}
          </p>
        )}

        {inclusiveSetupRequired ? (
          <div className="mt-8 rounded-3xl border border-pink-400/25 bg-pink-400/[.07] p-8 text-center backdrop-blur-xl">
            <span className="text-5xl">🫶</span>
            <h2 className="mt-5 text-2xl font-black">Completa le preferenze private</h2>
            <p className="mt-3 leading-7 text-gray-300">
              Per mostrarti match inclusivi dobbiamo verificare che le preferenze siano reciproche. Le tue scelte non saranno mostrate agli altri partecipanti o allo staff.
            </p>
            <button type="button" onClick={() => router.push(`/evento/${params.code}/preferenze`)} className="mt-7 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white">
              COMPLETA LE PREFERENZE
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
            <span className="text-5xl">✨</span>

            <h2 className="mt-5 text-2xl font-black">
              Nessun profilo disponibile
            </h2>

            <p className="mt-3 leading-7 text-gray-400">
              {inclusiveMode
                ? `Al momento non ci sono profili con preferenze reciproche e almeno il ${SOGLIA_COMPATIBILITA_MATCH}% di affinità. In modalità social puoi comunque conoscere persone con interessi diversi.`
                : `Al momento non ci sono profili con almeno il ${SOGLIA_COMPATIBILITA_MATCH}% di affinità. In modalità social puoi comunque conoscere nuove persone.`}
            </p>

            <div className="mt-7 grid gap-3">
              {inclusiveMode && (
                <button
                  type="button"
                  onClick={() => router.push(`/evento/${params.code}/preferenze`)}
                  className="w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white"
                >
                  MODIFICA LE PREFERENZE
                </button>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-full border border-pink-500/50 bg-pink-500/10 px-6 py-4 font-black text-white transition hover:bg-pink-500/20"
              >
                AGGIORNA
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {[matches[indiceAttivo]].filter((person): person is PersonaMatch => Boolean(person)).map((person) => (
              <article
                key={person.id}
                className="premium-glass premium-enter overflow-hidden rounded-[2.25rem]"
              >
                <div className="relative h-72 overflow-hidden bg-zinc-900">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={person.nickname || "Partecipante"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-7xl">👤</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                  <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-xs font-black uppercase tracking-wider text-white backdrop-blur">
                    {indiceAttivo + 1} di {matches.length}
                  </div>

                  {person.stato === "match" && (
                    <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-4 py-2 text-xs font-black text-white shadow-lg">
                      MATCH
                    </div>
                  )}

                  <div className="absolute bottom-5 left-5 right-5">
                    <h2 className="text-3xl font-black">
                      {person.nickname || "Partecipante"}
                    </h2>

                    <p className="mt-1 text-sm text-gray-300">
                      {person.age
                        ? `${person.age} anni`
                        : "Età non indicata"}
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  <div className="rounded-3xl border border-white/10 bg-black/35 p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                          Compatibilità
                        </p>

                        <p className="mt-2 text-sm font-bold text-gray-300">
                          {testoCompatibilita(person.compatibilita)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-5xl font-black text-white">
                          {person.compatibilita}
                        </span>
                        <span className="text-xl font-black text-pink-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${coloreCompatibilita(
                          person.compatibilita
                        )}`}
                        style={{ width: `${person.compatibilita}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => inviaInteresse(person)}
                    disabled={
                      azioneInCorso === person.id ||
                      person.stato === "liked" ||
                      person.stato === "match"
                    }
                    className={`mt-5 w-full rounded-full px-6 py-4 font-black transition ${
                      person.stato === "liked"
                        ? "border border-pink-500/30 bg-pink-500/10 text-pink-300"
                        : "bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 text-white shadow-[0_0_35px_rgba(236,72,153,0.22)] hover:scale-[1.02]"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {azioneInCorso === person.id
                      ? "INVIO..."
                      : person.stato === "match"
                        ? "🔥 MATCH FATTO"
                        : person.stato === "liked"
                          ? "💌 INTERESSE INVIATO"
                          : person.stato === "received_like"
                            ? "💌 RICAMBIA L’INTERESSE"
                            : "❤️ MI INTERESSA"}
                  </button>

                  {person.stato === "match" && (
                    <button
                      type="button"
                      onClick={() => apriChat(person)}
                      className="mt-3 w-full rounded-full border border-pink-500/50 bg-white/[0.04] px-6 py-4 font-black text-white transition hover:border-pink-400 hover:bg-pink-500/10"
                    >
                      💬 INIZIA LA CHAT
                    </button>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={vaiAlProfiloPrecedente}
                      disabled={matches.length < 2 || loadingAltri}
                      className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-4 text-sm font-black text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ‹ PRECEDENTE
                    </button>

                    <button
                      type="button"
                      onClick={() => void vaiAlProssimoProfilo()}
                      disabled={matches.length < 2 || loadingAltri}
                      className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-4 text-sm font-black text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {loadingAltri
                        ? "CARICAMENTO…"
                        : indiceAttivo === matches.length - 1 && !haAltriProfili
                          ? "RIVEDI DAL PRIMO"
                          : "PROSSIMO ›"}
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {haAltriProfili ? (
              <button
                type="button"
                onClick={caricaAltriProfili}
                disabled={loadingAltri}
                className="w-full rounded-full border border-pink-500/40 bg-pink-500/10 px-6 py-4 font-black text-white transition hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAltri
                  ? "CARICAMENTO..."
                  : "CARICA ALTRE PERSONE"}
              </button>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-gray-400">
                Hai visto tutti i profili disponibili ✨
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
