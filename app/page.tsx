import Link from "next/link"


export default function Home() {

  return (

    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">


      <h1 className="text-6xl font-bold tracking-widest text-pink-500">
        ZOCYAL
      </h1>


      <p className="mt-6 text-xl max-w-md text-gray-300">
        La serata dove ogni incontro può diventare qualcosa.
      </p>




      <Link

        href="/evento/test"

        className="mt-10 rounded-full bg-pink-500 px-10 py-4 text-black font-bold text-lg hover:scale-105 transition"

      >

        ENTRA NELLA SERATA

      </Link>





      <div className="mt-16 grid gap-5 text-left max-w-sm w-full">


        <div className="rounded-xl border border-pink-500/30 p-5">
          🎉 Conosci nuove persone
        </div>


        <div className="rounded-xl border border-pink-500/30 p-5">
          🎮 Partecipa alle missioni
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