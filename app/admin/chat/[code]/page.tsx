"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import { motion } from "framer-motion"



export default function Page(){


const params = useParams()

const code = params.code as string



const [messages,setMessages] = useState<any[]>([])

const [loading,setLoading] = useState(true)






async function caricaChat(){



const {data:partecipanti}=

await supabase

.from("participants")

.select("*")

.eq(

"event_code",

code

)





const ids =

(partecipanti || [])

.map(

(p)=>p.id

)






if(ids.length===0){

setLoading(false)

return

}






const {data:matchData}=

await supabase

.from("matches")

.select("*")

.or(

`user_one.in.(${ids.join(",")}),user_two.in.(${ids.join(",")})`

)






const matchIds =

(matchData || [])

.map(

(m)=>m.id

)






if(matchIds.length===0){

setMessages([])

setLoading(false)

return

}







const {data:messagesData,error}=

await supabase

.from("messages")

.select("*")

.in(

"match_id",

matchIds

)

.order(

"created_at",

{

ascending:false

}

)





if(error){

console.log(

"ERRORE CHAT ADMIN:",

error

)

}





const completi =

(messagesData || [])

.map((msg)=>{


const mittente =

partecipanti?.find(

(p)=>p.id===msg.sender_id

)



return{

...msg,

mittente

}



})





setMessages(completi)

setLoading(false)



}








useEffect(()=>{


if(!code){

return

}



caricaChat()





const channel =

supabase

.channel(

"admin-chat-" + code

)

.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"messages"

},

(payload)=>{



console.log(

"NUOVO MESSAGGIO ADMIN:",

payload.new

)



caricaChat()



}

)

.subscribe((status)=>{


console.log(

"CHAT ADMIN REALTIME:",

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

Carico chat...

</main>

)

}







return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">





<h1 className="text-5xl font-bold text-pink-500">

💬 Chat Live

</h1>



<p className="text-gray-400 mt-3">

Evento: {code}

</p>








<div className="mt-8 bg-white/10 border border-white/20 rounded-3xl p-6">


<p className="text-4xl font-bold">

💬 {messages.length}

</p>


<p className="text-gray-400">

Messaggi totali

</p>


</div>








<div className="mt-8 flex flex-col gap-4">





{

messages.map((msg,index)=>(



<motion.div


key={msg.id}


initial={{

opacity:0,

x:30

}}


animate={{

opacity:1,

x:0

}}


transition={{

delay:index*0.03

}}


className="bg-white text-black rounded-2xl p-5"

>





<p className="font-bold">

{msg.mittente?.nickname || "Utente"}

</p>



<p className="mt-2">

{msg.message}

</p>




<p className="text-xs text-gray-500 mt-3">

💬 Match ID: {msg.match_id}

</p>





</motion.div>



))


}





{

messages.length===0 &&

<div className="bg-white/10 rounded-3xl p-8 text-center">

Nessun messaggio ancora 💬

</div>

}



</div>





</main>


</div>


)


}
