"use client"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"
import { useState } from "react"

export default function Questionario() {
const params = useParams<{ code: string }>()
  const [answers, setAnswers] = useState<string[]>(Array(8).fill(""))


  const questions = [
    {
      q: "In una serata preferisci:",
      a: ["Conoscere tante persone", "Stare con pochi amici"]
    },
    {
      q: "Il tuo mood ideale è:",
      a: ["Ballare e divertirti", "Parlare e conoscere persone"]
    },
    {
      q: "Ti piace di più:",
      a: ["Una persona simile a te", "Una persona diversa da te"]
    },
    {
      q: "Sei più:",
      a: ["Spontaneo/a", "Riflessivo/a"]
    },
    {
      q: "In amore sei:",
      a: ["Romantico/a", "Ironico/a e leggero/a"]
    },
    {
      q: "Preferisci:",
      a: ["Fare il primo passo", "Essere cercato/a"]
    },
    {
      q: "La tua serata perfetta:",
      a: ["Avventura e sorprese", "Relax e tranquillità"]
    },
    {
      q: "Sei qui per:",
      a: ["Fare nuove amicizie", "Trovare una connessione speciale"]
    }
  ]


  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">

      <h1 className="text-4xl font-bold text-pink-500 text-center mb-8">
        ZOCYAL
      </h1>

      <h2 className="text-xl text-center mb-10">
        Troviamo le persone più compatibili con te
      </h2>


      <div className="max-w-md mx-auto flex flex-col gap-8">

        {questions.map((item,index)=>(
          <div key={index}>

            <p className="mb-3 font-bold">
              {index+1}. {item.q}
            </p>

            <div className="flex flex-col gap-2">

              {item.a.map((option)=>(
                <button
                  key={option}
                  onClick={()=>{
                    const newAnswers=[...answers]
                    newAnswers[index]=option
                    setAnswers(newAnswers)
                  }}
                  className={`p-3 rounded-lg ${
                    answers[index]===option
                    ? "bg-pink-500 text-black"
                    : "bg-white text-black"
                  }`}
                >
                  {option}
                </button>
              ))}

            </div>

          </div>
        ))}


       <button
  type="button"
  onClick={async () => {

  const participant_id = localStorage.getItem("participant_id")

  const { error } = await supabase
    .from("answers")
    .insert({
      participant_id,
      question_1: answers[0],
      question_2: answers[1],
      question_3: answers[2],
      question_4: answers[3],
      question_5: answers[4],
      question_6: answers[5],
      question_7: answers[6],
      question_8: answers[7]
    })


  if(error){
    console.log("ERRORE DATABASE:", error)
    alert(error.message)
    return
  }

  const { error: updateError } = await supabase
  .from("participants")
  .update({
    completed_test: true
  })
  .eq(
    "id",
    participant_id
  )


if(updateError){

  console.log(
    "ERRORE UPDATE PARTECIPANTE:",
    updateError
  )

  alert("Errore aggiornamento profilo")
  return

}
else{

  console.log(
    "TEST COMPLETATO SALVATO",
    participant_id
  )

}


window.location.href =
window.location.href =
`/evento/${params.code}/compatibilita`
}}
  className="bg-pink-500 text-black py-4 rounded-full font-bold"
>
  COMPLETA PROFILO
</button>


      </div>

    </main>
  )
}