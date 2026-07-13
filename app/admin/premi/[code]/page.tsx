"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import Sidebar from "@/app/admin/components/Sidebar"
import { motion } from "framer-motion"



export default function Page(){


const params = useParams()

const code = params.code as string



const [premi,setPremi] = useState<any[]>([

{
id:1,
nome:"Drink Gratis",
quantita:10,
assegnato:0
},

{
id:2,
nome:"Ingresso VIP",
quantita:2,
assegnato:0
}

])



const [nuovoPremio,setNuovoPremio] = useState("")

const [quantita,setQuantita] = useState(1)







function aggiungiPremio(){


if(!nuovoPremio){

return

}



setPremi((old)=>[

...old,

{

id:Date.now(),

nome:nuovoPremio,

quantita:Number(quantita),

assegnato:0

}

])


setNuovoPremio("")

setQuantita(1)


}







return(


<div className="min-h-screen bg-black text-white flex">


<Sidebar />



<main className="flex-1 p-8">



<div className="mb-10">


<h1 className="text-5xl font-bold text-pink-500">

🎁 Premi

</h1>


<p className="text-gray-400 mt-3">

Evento: {code}

</p>


</div>







<div className="bg-white/10 border border-white/20 rounded-3xl p-6 mb-10">


<h2 className="text-2xl font-bold mb-5">

➕ Aggiungi premio

</h2>



<div className="flex gap-4 flex-wrap">


<input

value={nuovoPremio}

onChange={(e)=>setNuovoPremio(e.target.value)}

placeholder="Nome premio"

className="p-3 rounded-xl text-black"

/>



<input

type="number"

value={quantita}

onChange={(e)=>setQuantita(Number(e.target.value))}

className="p-3 rounded-xl text-black w-28"

/>



<button

onClick={aggiungiPremio}

className="bg-pink-500 text-black px-6 rounded-xl font-bold"

>

Aggiungi

</button>


</div>


</div>








<div className="grid md:grid-cols-2 gap-6">





{

premi.map((premio,index)=>(



<motion.div


key={premio.id}


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



<h2 className="text-2xl font-bold">

🎁 {premio.nome}

</h2>




<div className="mt-5">


<p>

Disponibili:

<b>

{premio.quantita}

</b>

</p>


<p>

Assegnati:

<b>

{premio.assegnato}

</b>

</p>



</div>







<div className="mt-5">


<span className="bg-green-500 px-4 py-2 rounded-full font-bold">

Disponibile

</span>


</div>






</motion.div>



))


}



</div>





</main>


</div>


)


}