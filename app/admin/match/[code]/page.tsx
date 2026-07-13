"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Sidebar from "@/app/admin/components/Sidebar"
import { motion } from "framer-motion"



export default function Page(){


const params = useParams()

const code = params.code as string



const [matches,setMatches] = useState<any[]>([])

const [loading,setLoading] = useState(true)







async function caricaMatch(){



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

(persona)=>persona.id

)





if(ids.length===0){

setMatches([])

setLoading(false)

return

}






const {data:matchData,error}=

await supabase

.from("matches")

.select("*")

.or(

`user_one.in.(${ids.join(",")}),user_two.in.(${ids.join(",")})`

)






if(error){

console.log(

"ERRORE MATCH:",

error

)

}





const completi =

(matchData || [])

.map((match)=>{


const persona1 =

partecipanti?.find(

(p)=>p.id===match.user_one

)



const persona2 =

partecipanti?.find(

(p)=>p.id===match.user_two

)



return{

...match,

persona1,

persona2

}



})





setMatches(completi)

setLoading(false)



}









useEffect(()=>{


if(!code){

return

}



caricaMatch()





const channel =

supabase

.channel(

"admin-match-" + code

)

.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"matches"

},

(payload)=>{


console.log(

"NUOVO MATCH ADMIN:",

payload.new

)



caricaMatch()



}

)

.subscribe((status)=>{


console.log(

"MATCH REALTIME:",

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

Carico match...

</main>

)

}








return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="flex-1 p-8">



<div className="mb-10">


<h1 className="text-5xl font-bold text-pink-500">

❤️ Match

</h1>


<p className="text-gray-400 mt-3">

Evento: {code}

</p>


</div>







<div className="mb-8 bg-white/10 border border-white/20 rounded-3xl p-6">


<p className="text-3xl font-bold">

🔥 {matches.length}

</p>


<p className="text-gray-400">

Match creati

</p>


</div>







<div className="grid md:grid-cols-2 gap-6">





{

matches.map((match,index)=>(



<motion.div


key={match.id}


initial={{

opacity:0,

y:30

}}


animate={{

opacity:1,

y:0

}}


transition={{

delay:index*0.05

}}


className="bg-white text-black rounded-3xl p-6"

>





<h2 className="text-center text-xl font-bold mb-5">

🔥 MATCH

</h2>







<div className="flex items-center justify-center gap-5">






<div className="text-center">


{

match.persona1?.avatar_url &&

<img

src={match.persona1.avatar_url}

className="w-20 h-20 rounded-full object-cover mx-auto"

/>

}



<p className="font-bold mt-2">

{match.persona1?.nickname}

</p>


</div>






<div className="text-3xl">

❤️

</div>







<div className="text-center">


{

match.persona2?.avatar_url &&

<img

src={match.persona2.avatar_url}

className="w-20 h-20 rounded-full object-cover mx-auto"

/>

}



<p className="font-bold mt-2">

{match.persona2?.nickname}

</p>


</div>







</div>






</motion.div>



))


}



</div>






</main>


</div>


)



}