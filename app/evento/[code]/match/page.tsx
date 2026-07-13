"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function MatchPage(){

  const [matchUser, setMatchUser] = useState<any>(null)
  const [compatibilita, setCompatibilita] = useState<number>(0)
  const [loading, setLoading] = useState(true)



  function calcolaCompatibilita(a:any,b:any){

    const domande = [
      "question_1",
      "question_2",
      "question_3",
      "question_4",
      "question_5",
      "question_6",
      "question_7",
      "question_8"
    ]

    let uguali = 0


    domande.forEach((d)=>{

      if(
        a[d] &&
        b[d] &&
        a[d] === b[d]
      ){
        uguali++
      }

    })


    return Math.round(
      (uguali / domande.length) * 100
    )

  }



  useEffect(()=>{


    async function trovaMatch(){


      const mio_id =
      localStorage.getItem("participant_id")



      if(!mio_id){
        return
      }



      // trova match

      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .or(
          `user_one.eq.${mio_id},user_two.eq.${mio_id}`
        )
        .eq(
          "status",
          "matched"
        )
        .limit(1)
        .single()



      if(!match){
        setLoading(false)
        return
      }



      const altro_id =
        match.user_one === mio_id
        ?
        match.user_two
        :
        match.user_one




      // dati persona

      const { data: persona } = await supabase
        .from("participants")
        .select("*")
        .eq(
          "id",
          altro_id
        )
        .single()



      // risposte

      const { data: mieRisposte } =
      await supabase
      .from("answers")
      .select("*")
      .eq(
        "participant_id",
        mio_id
      )
      .single()



      const { data: sueRisposte } =
      await supabase
      .from("answers")
      .select("*")
      .eq(
        "participant_id",
        altro_id
      )
      .single()



      if(
        mieRisposte &&
        sueRisposte
      ){

        setCompatibilita(
          calcolaCompatibilita(
            mieRisposte,
            sueRisposte
          )
        )

      }



      setMatchUser(persona)

      setLoading(false)


    }


    trovaMatch()


  },[])



  if(loading){

    return(

      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        Cerco il tuo match... 🔥

      </main>

    )

  }



  if(!matchUser){

    return(

      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        Nessun match trovato

      </main>

    )

  }



  return(

    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">


      <div className="text-7xl animate-bounce">
        🔥
      </div>



      <h1 className="text-5xl font-bold text-pink-500 mt-5">
        MATCH!
      </h1>



      <p className="text-xl mt-4">
        Avete trovato una connessione ❤️
      </p>




      {matchUser.avatar_url && (

        <img

          src={matchUser.avatar_url}

          className="w-36 h-36 rounded-full object-cover mt-8 border-4 border-pink-500"

        />

      )}



      <h2 className="text-3xl font-bold mt-5">

        {matchUser.nickname}

      </h2>



      <p className="text-gray-400">

        {matchUser.age} anni

      </p>




      <div className="mt-8">

        <div className="text-6xl font-bold text-pink-500">

          {compatibilita}%

        </div>


        <p>
          compatibilità ❤️
        </p>

      </div>




      <div className="bg-white text-black rounded-2xl p-5 mt-8 max-w-sm">


        <p className="font-bold">

          Perché siete compatibili?

        </p>


        <p className="text-sm mt-2">

          Avete interessi e caratteristiche comuni.
          Ora tocca a voi conoscervi 🎉

        </p>


      </div>




      <button

        className="mt-8 bg-pink-500 text-black px-10 py-4 rounded-full font-bold"

      >

        💬 INIZIA CHAT

      </button>



    </main>

  )

}