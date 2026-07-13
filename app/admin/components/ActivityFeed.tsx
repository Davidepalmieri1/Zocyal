"use client"

import { motion } from "framer-motion"



interface Activity {

  id:string

  icon:string

  title:string

  description:string

  time:string

}



interface ActivityFeedProps {

  activities:Activity[]

}



export default function ActivityFeed({

  activities

}:ActivityFeedProps){



return(


<div className="mt-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">


<div className="flex items-center gap-3 mb-6">


<div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>


<h2 className="text-2xl font-bold">

🔥 Attività live

</h2>


</div>





<div className="flex flex-col gap-4">


{

activities.length === 0 && (


<p className="text-gray-400">

Nessuna attività recente

</p>


)

}





{

activities.map((activity,index)=>(



<motion.div


key={activity.id}


initial={{

opacity:0,

x:-30

}}


animate={{

opacity:1,

x:0

}}


transition={{

delay:index * 0.05

}}


className="bg-white/10 rounded-2xl p-4 flex items-center gap-4"

>



<div className="text-3xl">

{activity.icon}

</div>




<div className="flex-1">


<p className="font-bold">

{activity.title}

</p>



<p className="text-sm text-gray-300">

{activity.description}

</p>



</div>



<p className="text-xs text-gray-400">

{activity.time}

</p>



</motion.div>


))


}



</div>



</div>


)


}