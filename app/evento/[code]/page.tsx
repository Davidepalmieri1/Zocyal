import { supabase } from "@/lib/supabase"

export default async function Evento() {

  const { data: events, error } = await supabase
    .from("events")
    .select("*")

  console.log("EVENTI:", events)
  console.log("ERRORE:", error)

  const event = events?.[0]

  if (!event) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Nessun evento trovato
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">

      <h1 className="text-5xl font-bold text-pink-500">
        ZOCYAL
      </h1>

      <h2 className="mt-8 text-3xl">
        {event.name}
      </h2>

      <p className="mt-3 text-gray-400">
        {event.venue}
      </p>

      <a
  href={`/evento/${event.code}/profilo`}
  className="mt-10 bg-pink-500 text-black px-8 py-4 rounded-full font-bold"
>
  CREA IL TUO PROFILO
</a>

    </main>
  )
}