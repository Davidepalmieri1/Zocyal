"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"

const PROFILI_PER_PAGINA = 20

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
    reset ? setLoading(true) : setLoadingAltri(true)
    setErrore("")

    try {
      const indiceFinale = indiceIniziale + PROFILI_PER_PAGINA - 1

      const { data: altriPartecipanti, error: partecipantiError } =
  await supabase
    .from("participants")
    .select("id, nickname, age, avatar_url")
    .neq("id", participantId)
    .eq("event_code", eventCode)
    .eq("completed_test", true)
    .range(indiceIniziale, indiceFinale)

      if (partecipantiError) {
        console.error("Errore caricamento partecipanti:", {
  message: partecipantiError.message,
  details: partecipantiError.details,
  hint: partecipantiError.hint,
  code: partecipantiError.code,
})
        setErrore("Non siamo riusciti a caricare le affinità.")
        return
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

      const nuovePersone = partecipanti.map((person) => {
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

      setProssimoIndice(indiceIniziale + partecipanti.length)
      setHaAltriProfili(partecipanti.length === PROFILI_PER_PAGINA)
    } catch (error) {
      console.error("Errore imprevisto caricamento profili:", error)
      setErrore("Si è verificato un errore durante il caricamento.")
    } finally {
      setLoading(false)
      setLoadingAltri(false)
    }
  }

  async function caricaAltriProfili() {
    if (!mioId || loadingAltri || !haAltriProfili) return

    await caricaBloccoProfili(
      mioId,
      params.code.trim().toLowerCase(),
      prossimoIndice
    )
  }

  async function apriChat(person: PersonaMatch) {
    const participantId = localStorage.getItem("participant_id")

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

    const participantId = localStorage.getItem("participant_id")

    if (!participantId) {
      setErrore("Profilo non trovato.")
      return
    }

    setAzioneInCorso(person.id)
    setErrore("")

    try {
      const { error: likeError } = await supabase.from("likes").insert({
        from_participant: participantId,
        to_participant: person.id,
      })

      if (likeError && likeError.code !== "23505") {
        setErrore(`Errore durante l’invio dell’interesse: ${likeError.message}`)
        return
      }

      if (
        !likesRef.current.some(
          (like) =>
            like.from_participant === participantId &&
            like.to_participant === person.id
        )
      ) {
        likesRef.current = [
          ...likesRef.current,
          {
            from_participant: participantId,
            to_participant: person.id,
          },
        ]
      }

      const { data: reverseLike, error: reverseLikeError } = await supabase
        .from("likes")
        .select("id")
        .eq("from_participant", person.id)
        .eq("to_participant", participantId)
        .maybeSingle()

      if (reverseLikeError) {
        setErrore(
          `Errore durante il controllo del match: ${reverseLikeError.message}`
        )
        return
      }

      if (!reverseLike) {
        setMatches((attuali) =>
          attuali.map((persona) =>
            persona.id === person.id
              ? { ...persona, stato: "liked" }
              : persona
          )
        )
        return
      }

      const { data: matchEsistente, error: matchEsistenteError } =
        await supabase
          .from("matches")
          .select("id")
          .or(
            `and(user_one.eq.${participantId},user_two.eq.${person.id}),and(user_one.eq.${person.id},user_two.eq.${participantId})`
          )
          .maybeSingle()

      if (matchEsistenteError) {
        setErrore(
          `Errore durante la ricerca del match: ${matchEsistenteError.message}`
        )
        return
      }

      let matchId = matchEsistente?.id || null

      if (!matchId) {
        const { data: nuovoMatch, error: matchInsertError } = await supabase
          .from("matches")
          .insert({
            user_one: participantId,
            user_two: person.id,
            status: "matched",
          })
          .select("id")
          .single()

        if (matchInsertError) {
          setErrore(
            `Il like è stato inviato, ma il match non è stato creato: ${matchInsertError.message}`
          )
          return
        }

        matchId = nuovoMatch.id
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
    const participantId = localStorage.getItem("participant_id")
    const eventCode = params.code.trim().toLowerCase()

    setMioId(participantId)

    if (!participantId) {
      setErrore("Profilo non trovato.")
      setLoading(false)
      return
    }

    async function inizializzaPagina() {
      setLoading(true)
      setErrore("")
      setMatches([])
      setProssimoIndice(0)
      setHaAltriProfili(true)

      const [risposteResult, likesResult, matchesResult] = await Promise.all([
        supabase
          .from("answers")
          .select("*")
          .eq("participant_id", participantId)
          .maybeSingle(),
        supabase
          .from("likes")
          .select("id, from_participant, to_participant")
          .or(
            `from_participant.eq.${participantId},to_participant.eq.${participantId}`
          ),
        supabase
          .from("matches")
          .select("id, user_one, user_two")
          .or(
            `user_one.eq.${participantId},user_two.eq.${participantId}`
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
          filter: `to_participant=eq.${participantId}`,
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
            nuovoMatch.user_one !== participantId &&
            nuovoMatch.user_two !== participantId
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
            nuovoMatch.user_one === participantId
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
  }, [params.code])

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
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            Le tue affinità
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Persone compatibili
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Mostriamo massimo 20 nuovi profili alla volta,
            così la pagina resta veloce anche nelle serate più grandi.
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

        {matches.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
            <span className="text-5xl">✨</span>

            <h2 className="mt-5 text-2xl font-black">
              Nessun profilo disponibile
            </h2>

            <p className="mt-3 leading-7 text-gray-400">
              Aspetta che altre persone completino il profilo e torna tra poco.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-7 w-full rounded-full border border-pink-500/50 bg-pink-500/10 px-6 py-4 font-black text-white transition hover:bg-pink-500/20"
            >
              AGGIORNA
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {matches.map((person, index) => (
              <article
                key={person.id}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
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
                    #{index + 1} affinità
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