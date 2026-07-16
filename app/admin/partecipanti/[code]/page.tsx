"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import { motion } from "framer-motion"



export default function Page(){


const params = useParams()

const code = params.code as string



const [partecipanti,setPartecipanti] = useState<any[]>([])

const [ricerca,setRicerca] = useState("")

const [loading,setLoading] = useState(true)





useEffect(()=>{


if(!code){

return

}



async function caricaPartecipanti(){



const {data,error}=

await supabase

.from("participants")

.select("*")

.eq(

"event_code",

code

)



if(error){

console.log(
"ERRORE PARTECIPANTI:",
error
)

}



setPartecipanti(data || [])

setLoading(false)


}



caricaPartecipanti()





const channel =

supabase

.channel(

"admin-partecipanti-" + code

)

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

"NUOVO PARTECIPANTE:",

payload.new

)



setPartecipanti((old)=>[

payload.new,

...old

])


}

)

.subscribe((status)=>{


console.log(

"PARTECIPANTI REALTIME:",

status

)


})





return()=>{


supabase.removeChannel(channel)


}



},[code])








const filtrati =

partecipanti.filter((persona)=>

persona.nickname

?.toLowerCase()

.includes(

ricerca.toLowerCase()

)

)






if(loading){


return(

<main className="min-h-screen bg-black text-white flex items-center justify-center">

Carico partecipanti...

</main>

)

}



return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">



<div className="mb-10">


<h1 className="text-5xl font-bold text-pink-500">

👥 Partecipanti

</h1>


<p className="text-gray-400 mt-3">

Evento: {code}

</p>


</div>





<div className="mb-8">


<input

value={ricerca}

onChange={(e)=>setRicerca(e.target.value)}

placeholder="Cerca partecipante..."

className="w-full max-w-xl p-4 rounded-xl bg-white text-black outline-none"

/>


</div>








<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">





{

filtrati.map((persona,index)=>(



<motion.div


key={persona.id}


initial={{

opacity:0,

y:30

}}


animate={{

opacity:1,

y:0

}}


transition={{

delay:index * 0.05

}}


className="bg-white text-black rounded-3xl p-6 shadow-xl"

>





{

persona.avatar_url &&


<img

src={persona.avatar_url}

className="w-24 h-24 rounded-full object-cover mx-auto mb-4"

 />

}




<h2 className="text-2xl font-bold text-center">

{persona.nickname || "Senza nome"}

</h2>



<p className="text-center">

{persona.age || "?"} anni

</p>




<p className="text-center text-gray-500 mt-2">

🎯 {persona.goal || "Nessun obiettivo"}

</p>






<div className="mt-5 text-center">


{

persona.completed_test

?

<span className="bg-green-500 px-4 py-2 rounded-full text-black font-bold">

✅ Test completato

</span>

:

<span className="bg-gray-300 px-4 py-2 rounded-full">

⏳ Test incompleto

</span>

}



</div>





</motion.div>



))


}



</div>





</main>


</div>


)


}
