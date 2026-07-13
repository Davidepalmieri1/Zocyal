"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"


export default function MieiMatch(){


  const [matches,setMatches] = useState<any[]>([])
  const [loading,setLoading] = useState(true)



  useEffect(()=>{


    async function caricaMatch(){


      const mio_id =
      localStorage.getItem("participant_id")



      if(!mio_id){
        setLoading(false)
        return
      }



      // recupero tutti i match dell'utente

      const { data: mieiMatch } =
      await supabase
      .from("matches")
      .select("*")
      .or(
        `user_one.eq.${mio_id},user_two.eq.${mio_id}`
      )
      .eq(
        "status",
        "matched"
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      )



      if(!mieiMatch){

        setLoading(false)
        return

      }



      const lista = []



      for(const match of mieiMatch){


        const altro_id =
        match.user_one === mio_id
        ?
        match.user_two
        :
        match.user_one



        const { data: persona } =
        await supabase
        .from("participants")
        .select("*")
        .eq(
          "id",
          altro_id
        )
        .single()



        if(persona){

          lista.push({
            ...persona,
            match_id:match.id
          })

        }


      }



      setMatches(lista)

      setLoading(false)


    }



    caricaMatch()


  },[])



  if(loading){

    return(

      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        Carico i tuoi match ❤️

      </main>

    )

  }



  return(


    <main className="min-h-screen bg-black text-white px-6 py-10">


      <h1 className="text-5xl font-bold text-pink-500 text-center">

        ZOCYAL

      </h1>



      <h2 className="text-3xl text-center mt-8">

        I tuoi Match ❤️

      </h2>




      <div className="mt-10 flex flex-col gap-6">



      {
        matches.map((persona)=>(


          <div

          key={persona.match_id}

          className="bg-white text-black rounded-3xl p-6 text-center"

          >



          {persona.avatar_url && (

            <img

            src={persona.avatar_url}

            className="w-28 h-28 rounded-full object-cover mx-auto"

            />

          )}




          <h3 className="text-2xl font-bold mt-4">

            {persona.nickname}

          </h3>



          <p>

            {persona.age} anni

          </p>




          <button

onClick={()=>{

window.location.href =
`/evento/${window.location.pathname.split("/")[2]}/chat/${persona.match_id}`

}}

className="mt-5 bg-pink-500 text-black px-8 py-3 rounded-full font-bold"

>

💬 APRI CHAT

</button>



          </div>


        ))
      }




      {
        matches.length === 0 && (

          <p className="text-center text-gray-400">

            Nessun match ancora ❤️

          </p>

        )
      }



      </div>


    </main>


  )


}