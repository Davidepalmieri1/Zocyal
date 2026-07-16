"use client"

import { useParams } from "next/navigation"
import Sidebar from "@/app/admin/components/Sidebar"


export default function Page(){


const params = useParams()

const code = params.code as string



return(

<div className="min-h-screen bg-black text-white flex">


<Sidebar />


<main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">


<h1 className="text-4xl font-bold text-pink-500">

⚙️ Impostazioni

</h1>


<p className="mt-4 text-gray-400">

Configurazione evento:

{code}

</p>


<div className="mt-8 bg-white/10 rounded-3xl p-8 border border-white/20">

Pannello impostazioni pronto 🚀

</div>


</main>


</div>

)


}
