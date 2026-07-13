"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import StatCard from "@/app/admin/components/StatCard"
import ActivityFeed from "@/app/admin/components/ActivityFeed"



export default function Page(){


const params = useParams()

const code = params.code as string



const [evento,setEvento] = useState<any>(null)

const [partecipanti,setPartecipanti] = useState<any[]>([])

const [totMatch,setTotMatch] = useState(0)

const [totMessaggi,setTotMessaggi] = useState(0)

const [activities,setActivities] = useState<any[]>([])

const [loading,setLoading] = useState(true)





function aggiungiAttivita(activity:any){

setActivities((old)=>[

activity,

...old

].slice(0,10))


}







async function caricaDashboard(){


const { data:eventData } =
await supabase
.from("events")
.select("*")
.eq(
"code",
code
)
.single()



setEvento(eventData)





const { data:users } =
await supabase
.from("participants")
.select("*")
.eq(
"event_code",
code
)



const listaUtenti = users || []



setPartecipanti(listaUtenti)





const userIds =
listaUtenti.map(
(user)=>user.id
)





if(userIds.length > 0){



const { data:matches } =
await supabase
.from("matches")
.select("*")
.or(
`user_one.in.(${userIds.join(",")}),user_two.in.(${userIds.join(",")})`
)



const listaMatch =
matches || []



setTotMatch(
listaMatch.length
)



const matchIds =
listaMatch.map(
(match)=>match.id
)



if(matchIds.length > 0){



const { data:messages } =
await supabase
.from("messages")
.select("*")
.in(
"match_id",
matchIds
)



setTotMessaggi(
messages?.length || 0
)


}



}



setLoading(false)


}







useEffect(()=>{


if(!code){
return
}



caricaDashboard()



console.log(
"AVVIO REALTIME ADMIN:",
code
)





const channel = supabase
.channel(
"admin-live-" + code
)





// NUOVO PARTECIPANTE

.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"participants",

filter:`event_code=eq.${code}`

},

(payload)=>{


console.log(
"EVENTO PARTECIPANTE RICEVUTO:",
payload
)



const nuovoPartecipante:any = payload.new



setPartecipanti((old)=>{


const esiste =
old.some(
(p)=>p.id === nuovoPartecipante.id
)


if(esiste){

return old

}


return [

...old,

nuovoPartecipante

]


})



aggiungiAttivita({

id:Date.now().toString(),

icon:"👤",

title:"Nuovo partecipante",

description:
`${nuovoPartecipante.nickname || "Utente"} è entrato nell'evento`,

time:
new Date().toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})

})


}

)







// NUOVO MATCH

.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"matches"

},

(payload)=>{


console.log(
"EVENTO MATCH RICEVUTO:",
payload
)



setTotMatch(
(old)=>old+1
)



aggiungiAttivita({

id:Date.now().toString(),

icon:"❤️",

title:"Nuovo match",

description:
"Due partecipanti hanno fatto match",

time:
new Date().toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})

})


}

)







// NUOVO MESSAGGIO

.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"messages"

},

(payload)=>{


console.log(
"EVENTO MESSAGGIO RICEVUTO:",
payload
)



setTotMessaggi(
(old)=>old+1
)



aggiungiAttivita({

id:Date.now().toString(),

icon:"💬",

title:"Nuovo messaggio",

description:
"Nuova attività nella chat",

time:
new Date().toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})

})


}

)





.subscribe((status)=>{


console.log(
"ADMIN REALTIME STATUS:",
status
)


})





return ()=>{

supabase.removeChannel(channel)

}



},[code])







if(loading){

return(

<main className="min-h-screen bg-black text-white flex items-center justify-center">

Carico dashboard...

</main>

)

}







return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="flex-1 p-8">



<div className="mb-10">


<h1 className="text-5xl font-bold text-pink-500">

🔥 ZOCYAL

</h1>


<h2 className="text-3xl font-bold mt-3">

{evento?.name || "Evento"}

</h2>


<p className="text-gray-400">

📍 {evento?.venue}

</p>


<div className="inline-block mt-4 bg-green-500 text-black px-4 py-2 rounded-full font-bold">

🟢 Evento attivo

</div>


</div>





<div className="grid md:grid-cols-3 gap-6">


<StatCard

title="Partecipanti"

value={partecipanti.length}

icon="👥"

/>



<StatCard

title="Match creati"

value={totMatch}

icon="❤️"

/>



<StatCard

title="Messaggi"

value={totMessaggi}

icon="💬"

/>


</div>






<ActivityFeed

activities={activities}

/>







<div className="mt-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">


<h2 className="text-2xl font-bold mb-6">

👥 Partecipanti evento

</h2>



<div className="grid md:grid-cols-2 gap-4">



{

partecipanti.map((persona)=>(


<div

key={persona.id}

className="bg-white text-black rounded-2xl p-4 flex items-center gap-4 hover:scale-105 transition"

>


{

persona.avatar_url &&

<img

src={persona.avatar_url}

className="w-14 h-14 rounded-full object-cover"

/>

}



<div>


<h3 className="font-bold text-xl">

{persona.nickname || "Partecipante"}

</h3>


<p>

{persona.age} anni

</p>


<p className="text-sm text-gray-500">

{persona.goal}

</p>


</div>


</div>


))

}


</div>


</div>



</main>


</div>


)


}