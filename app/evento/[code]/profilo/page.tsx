"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function Profilo() {

  const params = useParams()

  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [goal, setGoal] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)

  async function salvaProfilo(e: React.FormEvent) {
    e.preventDefault()

    let avatar_url = ""

    if (photo) {

      const fileName = `${Date.now()}-${photo.name}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, photo)


      if (uploadError) {
        console.log(uploadError)
        alert("Errore caricamento foto")
        return
      }


      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName)

      avatar_url = data.publicUrl
    }


    const { data: participant, error } = await supabase
  .from("participants")
  .insert({
    event_code: params.code,
    nickname,
    age: Number(age),
    gender,
    goal,
    avatar_url
  })
  .select()
  .single()


    if (error) {
  console.log("ERRORE PROFILO:", error)
  alert(error.message)
  return
}

localStorage.setItem(
  "participant_id",
  participant.id
)
    window.location.href = `/evento/${params.code}/questionario`
    

  }


  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">

      <h1 className="text-5xl font-bold text-pink-500 mb-8">
        ZOCYAL
      </h1>

      <h2 className="text-2xl mb-8">
        Crea il tuo profilo
      </h2>


      <form
        onSubmit={salvaProfilo}
        className="w-full max-w-sm flex flex-col gap-4"
      >


        <input
          type="file"
          accept="image/*"
          onChange={(e)=>setPhoto(e.target.files?.[0] || null)}
          className="bg-white text-black p-3 rounded"
        />


        <input
          placeholder="Nome o soprannome"
          value={nickname}
          onChange={(e)=>setNickname(e.target.value)}
          className="p-4 rounded-lg bg-white text-black"
        />


        <input
          placeholder="Età"
          type="number"
          value={age}
          onChange={(e)=>setAge(e.target.value)}
          className="p-4 rounded-lg bg-white text-black"
        />


        <select
          value={gender}
          onChange={(e)=>setGender(e.target.value)}
          className="p-4 rounded-lg bg-white text-black"
        >
          <option value="">Sesso</option>
          <option>Uomo</option>
          <option>Donna</option>
          <option>Altro</option>
        </select>


        <select
          value={goal}
          onChange={(e)=>setGoal(e.target.value)}
          className="p-4 rounded-lg bg-white text-black"
        >
          <option value="">
            Obiettivo della serata
          </option>
          <option>🎉 Divertirmi</option>
          <option>🤝 Socializzare</option>
          <option>❤️ Trovare l'amore</option>
          <option>🏆 Vincere premi</option>
        </select>


        <button
          type="submit"
          className="mt-5 bg-pink-500 text-black py-4 rounded-full font-bold"
        >
          ENTRA IN ZOCYAL
        </button>

      </form>

    </main>
  )
}