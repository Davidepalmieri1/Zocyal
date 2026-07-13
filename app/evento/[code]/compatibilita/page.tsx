"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"



export default function Compatibilita(){


const [matches,setMatches] = useState<any[]>([])

const [loading,setLoading] = useState(true)






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


domande.forEach((domanda)=>{

if(
a[domanda] &&
b[domanda] &&
a[domanda] === b[domanda]
){

uguali++

}

})


return Math.round(
(uguali / domande.length) * 100
)

}







async function apriChat(person:any){


const mio_id =
localStorage.getItem("participant_id")


if(!mio_id){
return
}



let match_id = person.match_id




if(!match_id){


const {data:match}=

await supabase

.from("matches")

.select("id")

.or(

`and(user_one.eq.${mio_id},user_two.eq.${person.id}),and(user_one.eq.${person.id},user_two.eq.${mio_id})`

)

.single()



if(match){

match_id = match.id

}


}




if(!match_id){

console.log(
"Nessun match trovato"
)

return

}




const code =

window.location.pathname.split("/")[2]



window.location.href =

`/evento/${code}/chat/${match_id}`



}







useEffect(()=>{


const participant_id =
localStorage.getItem("participant_id")



if(!participant_id){

setLoading(false)

return

}






async function trovaMatch(){


const {data:mieRisposte}=

await supabase

.from("answers")

.select("*")

.eq(
"participant_id",
participant_id
)

.single()






const {data:altriPartecipanti}=

await supabase

.from("participants")

.select("*")

.neq(
"id",
participant_id
)

.eq(
"completed_test",
true
)







const {data:tutteRisposte}=

await supabase

.from("answers")

.select("*")







const risultati =

(altriPartecipanti || [])

.map((person)=>{


const sueRisposte =

tutteRisposte?.find(

(answer)=>

answer.participant_id === person.id

)



let compatibilita = 0



if(mieRisposte && sueRisposte){

compatibilita =

calcolaCompatibilita(

mieRisposte,

sueRisposte

)

}



return{

...person,

compatibilita

}


})








const ordinati =

risultati.sort(

(a,b)=>

b.compatibilita -

a.compatibilita

)








const {data:likes}=

await supabase

.from("likes")

.select("*")







const {data:userMatches}=

await supabase

.from("matches")

.select("*")








const conStato =

ordinati.map((person)=>{



const mioLike = likes?.find(

(like)=>

like.from_participant === participant_id

&&

like.to_participant === person.id

)





const ricevutoLike = likes?.find(

(like)=>

like.from_participant === person.id

&&

like.to_participant === participant_id

)





const match = userMatches?.find(

(m)=>

(

m.user_one === participant_id

&&
m.user_two === person.id

)

||

(

m.user_one === person.id

&&

m.user_two === participant_id

)

)





return{

...person,

match_id:match?.id || null,

stato:

match

?

"match"

:

mioLike

?

"liked"

:

ricevutoLike

?

"received_like"

:

"none"


}


})





setMatches(conStato)

setLoading(false)


}



trovaMatch()
// REALTIME LIKE + MATCH


const channel =

supabase

.channel(

"compatibilita-live-" + participant_id

)







.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"likes",

filter:

`to_participant=eq.${participant_id}`

},

(payload)=>{


const nuovoLike:any = payload.new



console.log(

"LIKE REALTIME:",

nuovoLike

)



setMatches((old)=>

old.map((person)=>{


if(

person.id === nuovoLike.from_participant

){


return{

...person,

stato:"received_like"

}


}


return person


})


)



}

)








.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"matches"

},

(payload)=>{


const nuovoMatch:any = payload.new



console.log(

"MATCH REALTIME:",

nuovoMatch

)





if(

nuovoMatch.user_one === participant_id

||

nuovoMatch.user_two === participant_id

){



const altroUtente =

nuovoMatch.user_one === participant_id

?

nuovoMatch.user_two

:

nuovoMatch.user_one





setMatches((old)=>

old.map((person)=>{


if(

person.id === altroUtente

){


return{

...person,

stato:"match",

match_id:nuovoMatch.id

}


}


return person


})

)


}


}

)





.subscribe((status)=>{


console.log(

"COMPATIBILITA REALTIME:",

status

)



})





return ()=>{


supabase.removeChannel(channel)


}




},[])








if(loading){

return(

<main className="min-h-screen bg-black text-white flex items-center justify-center">

Cerco i tuoi match 🔥

</main>

)

}







return(


<main className="min-h-screen bg-black text-white px-6 py-10">



<h1 className="text-5xl font-bold text-pink-500 text-center">

ZOCYAL

</h1>



<h2 className="text-3xl text-center mt-6">

I tuoi match ❤️

</h2>



<p className="text-center text-gray-400 mt-3">

Le persone più compatibili con te questa sera

</p>






<div className="mt-10 flex flex-col gap-6">



{

matches.map((person)=>(



<div

key={person.id}

className="bg-white text-black rounded-3xl p-6 shadow-xl"

>




{
person.avatar_url &&

<img

src={person.avatar_url}

alt={person.nickname}

className="w-28 h-28 rounded-full object-cover mx-auto mb-4"

/>

}




<h3 className="text-2xl font-bold text-center">

{person.nickname || "Partecipante"}

</h3>




<p className="text-center">

{person.age} anni

</p>





<div className="text-center mt-5">


<div className="text-5xl font-bold text-pink-500">

{person.compatibilita}%

</div>


<p>

compatibilità ❤️

</p>


</div>






<button


onClick={async()=>{


if(

person.stato !== "none"

&&

person.stato !== "received_like"

){

return

}




const mio_id =

localStorage.getItem("participant_id")



if(!mio_id){

return

}





const {error}=

await supabase

.from("likes")

.insert({

from_participant:mio_id,

to_participant:person.id

})




if(error){

console.log(

"ERRORE LIKE:",

error

)

return

}





setMatches((old)=>

old.map((p)=>

p.id === person.id

?

{

...p,

stato:"liked"

}

:

p

)

)







const {data:reverseLike}=

await supabase

.from("likes")

.select("*")

.eq(

"from_participant",

person.id

)

.eq(

"to_participant",

mio_id

)






if(

reverseLike &&

reverseLike.length > 0

){



const {data:matchEsistente}=

await supabase

.from("matches")

.select("*")

.or(

`and(user_one.eq.${mio_id},user_two.eq.${person.id}),and(user_one.eq.${person.id},user_two.eq.${mio_id})`

)







if(

!matchEsistente ||

matchEsistente.length===0

){


await supabase

.from("matches")

.insert({

user_one:mio_id,

user_two:person.id,

status:"matched"

})


}


}



}}



className="mt-5 w-full bg-pink-500 text-black py-4 rounded-full font-bold"

>



{

person.stato === "match"

?

"🔥 MATCH FATTO"


:

person.stato === "liked"

?

"💌 INTERESSE INVIATO"


:

person.stato === "received_like"

?

"💌 TI HA MESSO LIKE"


:

"❤️ MI INTERESSA"


}


</button>








{

person.stato === "match"

&&


<button


onClick={()=>apriChat(person)}


className="mt-3 w-full bg-black text-white py-4 rounded-full font-bold border border-pink-500 hover:scale-105 transition"

>


💬 INIZIA CHAT


</button>



}





</div>



))


}



</div>





</main>


)


}