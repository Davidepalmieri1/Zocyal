"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"



export default function Page(){


const [partecipanti,setPartecipanti] = useState(0)
const [match,setMatch] = useState(0)
const [messaggi,setMessaggi] = useState(0)



useEffect(()=>{


async function caricaDati(){


const { count: utenti } =
await supabase
.from("participants")
.select("*",{count:"exact",head:true})


const { count: totaleMatch } =
await supabase
.from("matches")
.select("*",{count:"exact",head:true})


const { count: totaleMessaggi } =
await supabase
.from("messages")
.select("*",{count:"exact",head:true})



setPartecipanti(
utenti || 0
)


setMatch(
totaleMatch || 0
)


setMessaggi(
totaleMessaggi || 0
)


}



caricaDati()



},[])





return(


<main className="min-h-screen bg-black text-white p-8">


<h1 className="text-5xl font-bold text-pink-500">

ZOCYAL

</h1>


<h2 className="text-2xl mt-3">

Event Organizer Dashboard

</h2>




<div className="grid md:grid-cols-3 gap-6 mt-10">



<div className="bg-white text-black rounded-3xl p-6">

<p className="text-gray-500">
Partecipanti
</p>

<h3 className="text-5xl font-bold text-pink-500">
{partecipanti}
</h3>

</div>




<div className="bg-white text-black rounded-3xl p-6">

<p className="text-gray-500">
Match creati
</p>

<h3 className="text-5xl font-bold text-pink-500">
{match}
</h3>

</div>




<div className="bg-white text-black rounded-3xl p-6">

<p className="text-gray-500">
Messaggi
</p>

<h3 className="text-5xl font-bold text-pink-500">
{messaggi}
</h3>

</div>


</div>





<div className="mt-10 bg-white text-black rounded-3xl p-8">


<h2 className="text-2xl font-bold mb-6">

Gestione Evento

</h2>



<div className="grid md:grid-cols-3 gap-4">



<button className="bg-pink-500 rounded-xl p-5 font-bold">

👥 Partecipanti

</button>


<button className="bg-pink-500 rounded-xl p-5 font-bold">

❤️ Match

</button>


<button className="bg-pink-500 rounded-xl p-5 font-bold">

💬 Chat

</button>


<button className="bg-pink-500 rounded-xl p-5 font-bold">

🎁 Premi

</button>


<button className="bg-pink-500 rounded-xl p-5 font-bold">

📊 Statistiche

</button>


<button className="bg-pink-500 rounded-xl p-5 font-bold">

⚙️ Impostazioni

</button>



</div>


</div>




</main>


)


}