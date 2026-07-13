"use client"

import { useState } from "react"


export default function Page(){


  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")


  function login(){


    console.log(
      "LOGIN ADMIN",
      email,
      password
    )


  }



  return(

    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">


      <div className="w-full max-w-md bg-white text-black rounded-3xl p-8 shadow-2xl">


        <h1 className="text-5xl font-bold text-pink-500 text-center">

          ZOCYAL

        </h1>


        <h2 className="text-xl text-center mt-4 font-bold">

          Area Organizzatore

        </h2>



        <div className="mt-8 flex flex-col gap-4">


          <input

          type="email"

          placeholder="Email organizzatore"

          value={email}

          onChange={(e)=>setEmail(e.target.value)}

          className="p-4 rounded-xl bg-gray-100 outline-none"

          />



          <input

          type="password"

          placeholder="Password"

          value={password}

          onChange={(e)=>setPassword(e.target.value)}

          className="p-4 rounded-xl bg-gray-100 outline-none"

          />



          <button

          onClick={login}

          className="mt-4 bg-pink-500 text-black py-4 rounded-full font-bold text-lg hover:scale-105 transition"

          >

            ENTRA

          </button>


        </div>


      </div>


    </main>

  )

}