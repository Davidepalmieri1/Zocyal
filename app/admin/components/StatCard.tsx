"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"



interface StatCardProps {

  title:string

  value:number | string

  icon:string

}



export default function StatCard({

  title,

  value,

  icon

}:StatCardProps){



const [count,setCount] = useState(0)



useEffect(()=>{


if(typeof value !== "number"){
  return
}


let start = 0


const duration = 800

const increment =
Math.max(
1,
Math.ceil(value / (duration / 30))
)



const timer = setInterval(()=>{


start += increment


if(start >= value){

setCount(value)

clearInterval(timer)

}

else{

setCount(start)

}


},30)



return ()=>clearInterval(timer)



},[value])





return(


<motion.div


initial={{
opacity:0,
y:40
}}


animate={{
opacity:1,
y:0
}}


transition={{
duration:0.5
}}


whileHover={{
scale:1.05
}}


className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl"

>


<div className="flex items-center justify-between">


<div>


<p className="text-gray-300 text-sm">

{title}

</p>



<h3 className="text-5xl font-bold text-white mt-3">


{
typeof value === "number"
?
count
:
value
}


</h3>


</div>



<div className="text-5xl">

{icon}

</div>


</div>


</motion.div>


)


}