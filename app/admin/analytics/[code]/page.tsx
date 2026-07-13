"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import { motion } from "framer-motion"



export default function Page(){


const params = useParams()

const code = params.code as string



const [partecipanti,setPartecipanti] = useState(0)

const [testCompletati,setTestCompletati] = useState(0)

const [match,setMatch] = useState(0)

const [messaggi,setMessaggi] = useState(0)

const [loading,setLoading] = useState(true)








async function caricaAnalytics(){



const {data:users}=

await supabase

.from("participants")

.select("*")

.eq(

"event_code",

code

)




const listaUtenti = users || []



setPartecipanti(

listaUtenti.length

)





setTestCompletati(

listaUtenti.filter(

(u)=>u.completed_test === true

).length

)






const ids =

listaUtenti.map(

(u)=>u.id

)






if(ids.length===0){

setLoading(false)

return

}








const {data:matches}=

await supabase

.from("matches")

.select("*")

.or(

`user_one.in.(${ids.join(",")}),user_two.in.(${ids.join(",")})`

)



setMatch(

matches?.length || 0

)








const matchIds =

(matches || [])

.map(

(m)=>m.id

)






if(matchIds.length>0){



const {data:messages}=

await supabase

.from("messages")

.select("*")

.in(

"match_id",

matchIds

)



setMessaggi(

messages?.length || 0

)



}



setLoading(false)



}








useEffect(()=>{


if(!code){

return

}



caricaAnalytics()





const channel =

supabase

.channel(

"analytics-live-" + code

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


caricaAnalytics()


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


caricaAnalytics()


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


caricaAnalytics()


}

)




.subscribe((status)=>{


console.log(

"ANALYTICS REALTIME:",

status

)


})







return()=>{


supabase.removeChannel(channel)


}



},[code])









if(loading){

return(

<main className="min-h-screen bg-black text-white flex items-center justify-center">

Carico analytics...

</main>

)

}









const cards=[


{

title:"Partecipanti",

value:partecipanti,

icon:"👥"

},


{

title:"Test completati",

value:testCompletati,

icon:"🎯"

},


{

title:"Match creati",

value:match,

icon:"❤️"

},


{

title:"Messaggi",

value:messaggi,

icon:"💬"

}


]








return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="flex-1 p-8">



<div className="mb-10">


<h1 className="text-5xl font-bold text-pink-500">

📈 Analytics Live

</h1>


<p className="text-gray-400 mt-3">

Evento: {code}

</p>


</div>








<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">





{

cards.map((card,index)=>(



<motion.div


key={card.title}


initial={{

opacity:0,

y:30

}}


animate={{

opacity:1,

y:0

}}


transition={{

delay:index*0.1

}}


className="bg-white text-black rounded-3xl p-6"

>


<div className="text-4xl">

{card.icon}

</div>



<h2 className="text-gray-500 mt-4">

{card.title}

</h2>



<p className="text-5xl font-bold mt-2">

{card.value}

</p>



</motion.div>



))


}



</div>









<div className="mt-10 bg-white/10 border border-white/20 rounded-3xl p-8">


<h2 className="text-2xl font-bold">

🔥 Engagement evento

</h2>



<p className="mt-4 text-gray-300">

Gli utenti stanno creando connessioni in tempo reale.

</p>



</div>







</main>


</div>


)


}