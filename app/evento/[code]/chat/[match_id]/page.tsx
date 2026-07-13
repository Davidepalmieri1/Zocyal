"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"


export default function ChatPage(){


  const params = useParams()

  const match_id =
  params.match_id as string



  const [messages,setMessages] = useState<any[]>([])
  const [text,setText] = useState("")
  const [loading,setLoading] = useState(true)
  const [persona,setPersona] = useState<any>(null)
  const [typing,setTyping] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)



  const mio_id =
  typeof window !== "undefined"
  ?
  localStorage.getItem("participant_id")
  :
  null




  // scroll automatico

  useEffect(()=>{

    bottomRef.current?.scrollIntoView({
      behavior:"smooth"
    })

  },[messages])






  // caricamento chat + realtime

  useEffect(()=>{


    if(!match_id){
      return
    }



    async function caricaChat(){


      const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq(
        "match_id",
        match_id
      )
      .order(
        "created_at",
        {
          ascending:true
        }
      )



      if(error){

        console.log(
          "ERRORE MESSAGGI:",
          error
        )

      }



      setMessages(data || [])




      const { data: match } =
      await supabase
      .from("matches")
      .select("*")
      .eq(
        "id",
        match_id
      )
      .single()



      if(match){


        const altro_id =
        match.user_one === mio_id
        ?
        match.user_two
        :
        match.user_one



        const { data: profilo } =
        await supabase
        .from("participants")
        .select("*")
        .eq(
          "id",
          altro_id
        )
        .single()



        setPersona(profilo)

      }



      setLoading(false)


    }



    caricaChat()



    const channel =
    supabase
    .channel(
      "chat-" + match_id
    )


    .on(
      "postgres_changes",
      {
        event:"INSERT",
        schema:"public",
        table:"messages",
        filter:`match_id=eq.${match_id}`
      },
      (payload)=>{


        setMessages((old)=>[
          ...old,
          payload.new
        ])


      }
    )


    .on(
      "broadcast",
      {
        event:"typing"
      },
      (payload)=>{


        if(payload.payload.user !== mio_id){

          setTyping(
            payload.payload.status
          )

        }


      }
    )


    .subscribe()



    return ()=>{

      supabase.removeChannel(channel)

    }



  },[match_id])






  function mandaTyping(status:boolean){


    supabase
    .channel(
      "chat-" + match_id
    )
    .send({

      type:"broadcast",

      event:"typing",

      payload:{

        user:mio_id,

        status

      }

    })


  }





  function stoScrivendo(){


    mandaTyping(true)



    setTimeout(()=>{

      mandaTyping(false)

    },2000)


  }







  async function inviaMessaggio(){


    if(!text.trim()){
      return
    }


    if(!mio_id){
      return
    }



    mandaTyping(false)



    const { error } =
    await supabase
    .from("messages")
    .insert({

      match_id,

      sender_id:mio_id,

      message:text

    })



    if(error){

      console.log(
        "ERRORE INVIO:",
        error
      )

      return

    }



    setText("")


  }






  if(loading){

    return(

      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        Carico chat...

      </main>

    )

  }






  return(

    <main className="min-h-screen bg-black text-white flex flex-col">


      <header className="p-5 border-b border-gray-700 flex items-center gap-4">


        {
        persona?.avatar_url && (

          <img
          src={persona.avatar_url}
          className="w-14 h-14 rounded-full object-cover"
          />

        )
        }



        <div>

          <h1 className="text-xl font-bold">
            {persona?.nickname || "Chat"}
          </h1>


          <p className="text-sm text-green-400">
            🟢 Online
          </p>


          {
          typing && (

            <p className="text-sm text-pink-400">
              Sta scrivendo...
            </p>

          )
          }


        </div>


      </header>






      <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto">


      {
        messages.map((msg)=>(


          <div

          key={msg.id}

          className={

          msg.sender_id === mio_id

          ?

          "self-end bg-pink-500 text-black p-3 rounded-2xl max-w-xs shadow-lg"

          :

          "self-start bg-gray-200 text-black p-3 rounded-2xl max-w-xs shadow-lg"

          }

          >


            <p>
              {msg.message}
            </p>


            <span className="text-xs opacity-60 block mt-1">

            {new Date(msg.created_at).toLocaleTimeString([],{
              hour:"2-digit",
              minute:"2-digit"
            })}

            </span>


          </div>


        ))
      }



      <div ref={bottomRef}></div>


      </div>






      <div className="p-5 flex gap-3">


        <input

        value={text}

        onChange={(e)=>{

          setText(e.target.value)

          stoScrivendo()

        }}

        placeholder="Scrivi un messaggio..."

        className="flex-1 p-3 rounded-full bg-white text-black placeholder-gray-500 px-5 outline-none"

        />



        <button

        onClick={inviaMessaggio}

        className="bg-pink-500 text-black px-6 py-3 rounded-full font-bold"

        >

          INVIA

        </button>


      </div>


    </main>

  )

}