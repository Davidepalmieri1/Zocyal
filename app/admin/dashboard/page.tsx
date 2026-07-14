"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import StatCard from "@/app/admin/components/StatCard"
import EventQR from "@/app/admin/components/EventQR"



export default function Page(){


const params = useParams()

const code = params.code as string



const [evento,setEvento] = useState<any>(null)

const [partecipanti,setPartecipanti] = useState(0)

const [match,setMatch] = useState(0)

const [messaggi,setMessaggi] = useState(0)







async function caricaDati(){



const {data:eventData}=

await supabase

.from("events")

.select("*")

.eq(

"code",

code

)

.single()



setEvento(eventData)






const {count:utenti}=

await supabase

.from("participants")

.select("*",{count:"exact",head:true})

.eq(

"event_code",

code

)



const {count:totaleMatch}=

await supabase

.from("matches")

.select("*",{count:"exact",head:true})





const {count:totaleMessaggi}=

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







useEffect(()=>{


if(!code){

return

}



caricaDati()



const channel =

supabase

.channel(

"dashboard-live-" + code

)



.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"participants",

filter:`event_code=eq.${code}`

},

()=>{

caricaDati()

}

)



.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"matches"

},

()=>{

caricaDati()

}

)



.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"messages"

},

()=>{

caricaDati()

}

)



.subscribe()





return()=>{

supabase.removeChannel(channel)

}



},[code])








return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="flex-1 p-8">



<h1 className="text-5xl font-bold text-pink-500">

🔥 ZOCYAL

</h1>



<h2 className="text-3xl font-bold mt-3">

{evento?.name || "Evento"}

</h2>



<p className="text-gray-400 mt-2">

📍 {evento?.venue}

</p>







<div className="grid md:grid-cols-3 gap-6 mt-10">



<StatCard

title="Partecipanti"

value={partecipanti}

icon="👥"

/>



<StatCard

title="Match creati"

value={match}

icon="❤️"

/>



<StatCard

title="Messaggi"

value={messaggi}

icon="💬"

/>



</div>






<h1 className="text-red-500 text-4xl">
QR TEST ATTIVO
</h1>

<div className="mt-10">

<EventQR

code={code}

name={evento?.name || "Evento"}

venue={evento?.venue || ""}

/>

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

📊 Analytics

</button>



<button className="bg-pink-500 rounded-xl p-5 font-bold">

⚙️ Impostazioni

</button>



</div>


</div>





</main>


</div>


)


}