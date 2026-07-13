"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useParams, usePathname } from "next/navigation"


export default function Sidebar(){


const params = useParams()

const pathname = usePathname()


const code = params.code as string



const menu = [

{
name:"Dashboard",
icon:"📊",
path:"dashboard"
},

{
name:"Partecipanti",
icon:"👥",
path:"partecipanti"
},

{
name:"Match",
icon:"❤️",
path:"match"
},

{
name:"Chat",
icon:"💬",
path:"chat"
},

{
name:"Premi",
icon:"🎁",
path:"premi"
},

{
name:"Analytics",
icon:"📈",
path:"analytics"
},

{
name:"Impostazioni",
icon:"⚙️",
path:"impostazioni"
}

]




return(


<motion.aside

initial={{
x:-100,
opacity:0
}}

animate={{
x:0,
opacity:1
}}

transition={{
duration:0.5
}}

className="w-72 min-h-screen bg-black text-white border-r border-gray-800 p-6"

>


<motion.h1

initial={{
scale:0.8
}}

animate={{
scale:1
}}

transition={{
duration:0.5
}}

className="text-4xl font-bold text-pink-500 mb-10"

>

🔥 ZOCYAL

</motion.h1>





<nav className="flex flex-col gap-3">


{

menu.map((item,index)=>{


const link =

item.path === "dashboard"

?

`/admin/dashboard/${code}`

:

`/admin/${item.path}/${code}`



const active =

pathname.includes(item.path)





return(


<motion.div

key={item.name}

initial={{
opacity:0,
x:-20
}}

animate={{
opacity:1,
x:0
}}

transition={{
delay:index * 0.08
}}

>


<Link

href={link}

className={

`
flex items-center gap-4 p-4 rounded-xl font-semibold transition duration-300

${

active

?

"bg-pink-500 text-black"

:

"hover:bg-pink-500 hover:text-black"

}

`

}

>


<span className="text-xl">

{item.icon}

</span>


{item.name}


</Link>


</motion.div>


)


})

}


</nav>





<div className="absolute bottom-6 text-sm text-gray-500">

Zocyal Admin v1.0

</div>




</motion.aside>


)


}