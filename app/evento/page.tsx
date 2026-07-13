"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"



export default function Page(){


const router = useRouter()


const [code,setCode] = useState("")





function entraEvento(){


if(!code.trim()){

return

}



router.push(
`/evento/${code.trim().toLowerCase()}`
)


}







return(


<main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">





<h1 className="text-6xl font-bold text-pink-500 tracking-widest">

ZOCYAL

</h1>






<p className="mt-6 text-xl text-gray-300 max-w-md">

Inserisci il codice della serata per entrare nella community

</p>








<input


value={code}


onChange={(e)=>setCode(e.target.value)}


onKeyDown={(e)=>{

if(e.key==="Enter"){

entraEvento()

}

}}


placeholder="Codice evento"


className="
mt-8
w-72
px-6
py-4
rounded-full
bg-white
text-black
placeholder:text-gray-400
text-center
text-lg
font-semibold
outline-none
border-2
border-pink-500
focus:ring-4
focus:ring-pink-500/30
transition
"


/>








<button


onClick={entraEvento}


className="
mt-6
bg-pink-500
text-black
px-12
py-4
rounded-full
font-bold
text-lg
hover:scale-105
transition
shadow-lg
shadow-pink-500/30
"


>


🔥 ENTRA NELLA SERATA


</button>








<div className="mt-16 grid gap-5 max-w-sm w-full">





<div className="rounded-xl border border-pink-500/30 p-5">

🎉 Conosci nuove persone

</div>





<div className="rounded-xl border border-pink-500/30 p-5">

❤️ Trova connessioni compatibili

</div>





<div className="rounded-xl border border-pink-500/30 p-5">

🏆 Vinci premi

</div>





</div>








</main>


)


}