"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"

const questions = [
  {
    q: "In una serata preferisci:",
    a: ["Conoscere tante persone", "Stare con pochi amici"],
  },
  {
    q: "Il tuo mood ideale è:",
    a: ["Ballare e divertirti", "Parlare e conoscere persone"],
  },
  {
    q: "Ti piace di più:",
    a: ["Una persona simile a te", "Una persona diversa da te"],
  },
  {
    q: "Sei più:",
    a: ["Spontaneo/a", "Riflessivo/a"],
  },
  {
    q: "In amore sei:",
    a: ["Romantico/a", "Ironico/a e leggero/a"],
  },
  {
    q: "Preferisci:",
    a: ["Fare il primo passo", "Essere cercato/a"],
  },
  {
    q: "La tua serata perfetta:",
    a: ["Avventura e sorprese", "Relax e tranquillità"],
  },
  {
    q: "Sei qui per:",
    a: ["Fare nuove amicizie", "Trovare una connessione speciale"],
  },
]

export default function QuestionarioPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()

  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill("")
  )

  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState("")

  const risposteDate = answers.filter(Boolean).length
  const completo = risposteDate === questions.length

  const percentuale = Math.round(
    (risposteDate / questions.length) * 100
  )

  function selezionaRisposta(index: number, risposta: string) {
    setAnswers((attuali) => {
      const nuove = [...attuali]
      nuove[index] = risposta
      return nuove
    })

    setErrore("")
  }

  async function salvaQuestionario() {
    if (!completo) {
      setErrore("Rispondi a tutte le domande prima di continuare.")
      return
    }

    const participantId =
      localStorage.getItem("participant_id")?.trim()

    const eventCode = params.code.trim().toLowerCase()

    if (!participantId) {
      setErrore(
        "Profilo non trovato. Crea nuovamente il profilo."
      )
      return
    }

    setLoading(true)
    setErrore("")

    try {
      /*
       * Prima controlliamo che il partecipante salvato
       * nel browser esista davvero e appartenga all'evento.
       */
      const {
        data: partecipante,
        error: partecipanteError,
      } = await supabase
        .from("participants")
        .select("id, event_code, completed_test")
        .eq("id", participantId)
        .eq("event_code", eventCode)
        .maybeSingle()

      if (partecipanteError) {
        console.error(
          "Errore controllo partecipante:",
          partecipanteError
        )

        setErrore(
          "Errore durante il controllo del profilo."
        )
        return
      }

      if (!partecipante) {
        localStorage.removeItem("participant_id")

        setErrore(
          "Questo profilo non esiste più. Torna indietro e ricrealo."
        )
        return
      }

      /*
       * Salviamo o aggiorniamo le otto risposte.
       */
      const { error: answersError } = await supabase
        .from("answers")
        .upsert(
          {
            participant_id: participantId,
            question_1: answers[0],
            question_2: answers[1],
            question_3: answers[2],
            question_4: answers[3],
            question_5: answers[4],
            question_6: answers[5],
            question_7: answers[6],
            question_8: answers[7],
          },
          {
            onConflict: "participant_id",
          }
        )

      if (answersError) {
        console.error(
          "Errore salvataggio risposte:",
          answersError
        )

        setErrore(
          `Errore salvataggio risposte: ${answersError.message}`
        )
        return
      }

      /*
       * Aggiorniamo completed_test e chiediamo a Supabase
       * di restituirci la riga realmente modificata.
       */
      const {
        data: partecipanteAggiornato,
        error: participantUpdateError,
      } = await supabase
        .from("participants")
        .update({
          completed_test: true,
        })
        .eq("id", participantId)
        .eq("event_code", eventCode)
        .select("id, completed_test")
        .maybeSingle()

      if (participantUpdateError) {
        console.error(
          "Errore aggiornamento partecipante:",
          participantUpdateError
        )

        setErrore(
          `Errore aggiornamento profilo: ${participantUpdateError.message}`
        )
        return
      }

      /*
       * Un update può non restituire errori ma modificare zero righe.
       * Questo controllo evita di proseguire con completed_test false.
       */
      if (
        !partecipanteAggiornato ||
        partecipanteAggiornato.completed_test !== true
      ) {
        console.error(
          "Il partecipante non è stato aggiornato.",
          {
            participantId,
            eventCode,
            partecipanteAggiornato,
          }
        )

        setErrore(
          "Le risposte sono state salvate, ma il profilo non è stato completato. Controlla le policy UPDATE della tabella participants in Supabase."
        )
        return
      }

      localStorage.setItem("event_code", eventCode)

      router.push(`/evento/${eventCode}/scegli`)
    } catch (error) {
      console.error(
        "Errore imprevisto nel questionario:",
        error
      )

      setErrore(
        "Si è verificato un errore imprevisto. Riprova."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

      <div className="absolute bottom-[-180px] right-[-140px] h-[360px] w-[360px] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-md">
        <Logo size="medium" />

        <div className="mt-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-400">
            Secondo passo
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Conosciamoci meglio
          </h1>

          <p className="mt-3 leading-7 text-gray-400">
            Rispondi d’istinto. Non esistono risposte giuste o
            sbagliate.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">
                Il tuo progresso
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {risposteDate} di {questions.length} risposte
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-pink-400/30 bg-pink-500/10 text-sm font-black text-pink-300">
              {percentuale}%
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 transition-all duration-500"
              style={{
                width: `${percentuale}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {questions.map((item, index) => (
            <section
              key={item.q}
              className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-400/30 bg-pink-500/10 text-sm font-black text-pink-300">
                  {index + 1}
                </div>

                <p className="pt-1 text-base font-black leading-6 text-white">
                  {item.q}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {item.a.map((option) => {
                  const selezionata =
                    answers[index] === option

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        selezionaRisposta(index, option)
                      }
                      className={`group flex min-h-16 w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition duration-300 ${
                        selezionata
                          ? "border-pink-400/60 bg-gradient-to-r from-fuchsia-600/25 via-pink-500/20 to-orange-400/15 text-white shadow-[0_12px_35px_rgba(236,72,153,0.14)]"
                          : "border-white/10 bg-black/35 text-gray-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className="font-bold">
                        {option}
                      </span>

                      <span
                        className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                          selezionata
                            ? "border-pink-300 bg-pink-400 text-black"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {selezionata && (
                          <span className="text-xs font-black">
                            ✓
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

          {errore && (
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm leading-6 text-red-300">
              {errore}
            </p>
          )}

          <button
            type="button"
            onClick={salvaQuestionario}
            disabled={loading}
            className="mt-2 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 py-4 text-lg font-black text-white shadow-[0_0_40px_rgba(236,72,153,0.25)] transition hover:scale-[1.02] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "SALVATAGGIO..."
              : "CONTINUA"}
          </button>

          <p className="text-center text-xs leading-5 text-gray-500">
            Le risposte servono per migliorare le affinità
            mostrate durante la serata.
          </p>
        </div>
      </div>
    </main>
  )
}