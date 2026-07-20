"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Logo from "@/app/components/Logo"
import PremiumBackdrop from "@/app/components/PremiumBackdrop"
import { ensureAnonymousSession } from "@/app/lib/participant-session"
import { supabase } from "@/lib/supabase"

type MatchRecord = {
  id: string
  user_one: string
  user_two: string
}

type Participant = {
  id: string
  nickname: string
  age: number | null
  avatar_url: string | null
  goal: string | null
}

type Answers = Record<string, string | null>

const questions = ["question_1", "question_2", "question_3", "question_4", "question_5", "question_6", "question_7", "question_8"]

function calculateCompatibility(a: Answers, b: Answers) {
  const answered = questions.filter((question) => a[question] && b[question])
  if (!answered.length) return 0
  const equal = answered.filter((question) => a[question] === b[question]).length
  return Math.round((equal / answered.length) * 100)
}

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message
  if (cause && typeof cause === "object") {
    const value = cause as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    return [value.message, value.details, value.hint, value.code]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" · ")
  }
  return String(cause || "Errore sconosciuto")
}

export default function MatchPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<MatchRecord | null>(null)
  const [person, setPerson] = useState<Participant | null>(null)
  const [compatibility, setCompatibility] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function findMatch() {
      const myId = localStorage.getItem("participant_id")
      if (!myId) {
        router.replace(`/evento/${code}/codice-accesso`)
        return
      }

      try {
        await ensureAnonymousSession()

        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("id,user_one,user_two")
          .or(`user_one.eq.${myId},user_two.eq.${myId}`)
          .eq("status", "matched")
          .limit(1)
          .maybeSingle()

        if (matchError) throw matchError
        if (!matchData) return

        const currentMatch = matchData as MatchRecord
        const otherId = currentMatch.user_one === myId ? currentMatch.user_two : currentMatch.user_one
        const [personResult, myAnswersResult, theirAnswersResult] = await Promise.all([
          supabase.from("participants").select("id,nickname,age,avatar_url,goal").eq("id", otherId).single(),
          supabase.from("answers").select("question_1,question_2,question_3,question_4,question_5,question_6,question_7,question_8").eq("participant_id", myId).maybeSingle(),
          supabase.from("answers").select("question_1,question_2,question_3,question_4,question_5,question_6,question_7,question_8").eq("participant_id", otherId).maybeSingle(),
        ])

        if (personResult.error) throw personResult.error
        if (!active) return

        setMatch(currentMatch)
        setPerson(personResult.data as Participant)
        if (myAnswersResult.data && theirAnswersResult.data) {
          setCompatibility(calculateCompatibility(myAnswersResult.data as Answers, theirAnswersResult.data as Answers))
        }
      } catch (cause) {
        console.warn("Errore caricamento match:", errorMessage(cause))
        if (active) setError("Non siamo riusciti a caricare questo match.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void findMatch()
    return () => { active = false }
  }, [code, router])

  if (loading) {
    return <main className="premium-page flex min-h-screen items-center justify-center px-6 text-white"><PremiumBackdrop /><div className="premium-enter text-center"><div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-white/10 border-t-pink-400" /><p className="premium-eyebrow mt-6">Cerchiamo la scintilla</p><h1 className="mt-3 text-2xl font-black">Il tuo match sta arrivando…</h1></div></main>
  }

  if (error || !person || !match) {
    return <main className="premium-page flex min-h-screen items-center justify-center px-6 text-white"><PremiumBackdrop /><section className="premium-glass max-w-md rounded-[2rem] p-8 text-center"><span className="text-5xl">✦</span><h1 className="premium-title mt-5 text-4xl font-black">{error ? "Qualcosa non ha funzionato" : "La serata è ancora aperta"}</h1><p role={error ? "alert" : undefined} className="mt-4 leading-7 text-white/50">{error || "Non c’è ancora un nuovo match. Continua a scoprire le affinità: potrebbe essere dietro il prossimo profilo."}</p><button onClick={() => router.push(`/evento/${code}/compatibilita`)} className="premium-cta mt-7 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 text-sm font-black uppercase tracking-[.1em]">Continua a scoprire</button></section></main>
  }

  return (
    <main className="premium-page min-h-screen px-5 py-8 text-white sm:px-8 sm:py-12">
      <PremiumBackdrop />
      <div aria-hidden="true" className="absolute inset-x-0 top-[18%] text-center text-[18rem] font-black leading-none text-pink-400/[.025] sm:text-[28rem]">♥</div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between"><Logo size="small" /><span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.07] px-4 py-2 text-[10px] font-black uppercase tracking-[.17em] text-emerald-300">Connessione reciproca</span></header>

      <section className="relative mx-auto grid min-h-[calc(100svh-120px)] max-w-6xl items-center gap-10 py-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <motion.div initial={{ opacity: 0, scale: .9, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 100, damping: 16 }} className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[3.5rem] bg-gradient-to-br from-fuchsia-500/25 via-pink-500/10 to-orange-400/20 blur-2xl" />
          <div className="premium-glass relative overflow-hidden rounded-[3rem] p-3">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.4rem] bg-[#171119]">
              {person.avatar_url ? <img src={person.avatar_url} alt={`Foto profilo di ${person.nickname}`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-orange-400/10 text-8xl font-black text-white/65">{person.nickname.slice(0, 1).toUpperCase()}</div>}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7"><p className="premium-eyebrow">It’s a match</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{person.nickname}</h1><p className="mt-2 text-sm font-semibold text-white/55">{person.age ? `${person.age} anni` : "Nuova connessione"}{person.goal ? ` · ${person.goal}` : ""}</p></div>
            </div>
          </div>
        </motion.div>

        <div className="text-center lg:text-left">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}><p className="premium-eyebrow">Avete scelto entrambi</p><h2 className="premium-title mt-4 text-5xl font-black sm:text-7xl">Adesso<br /><span className="premium-gradient-text">succede davvero.</span></h2></motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }} className="premium-glass mt-8 flex items-center gap-5 rounded-[2rem] p-5 text-left sm:p-6"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-pink-300/20 bg-pink-400/10 text-3xl font-black text-pink-200">{compatibility}%</div><div><p className="text-xs font-black uppercase tracking-[.16em] text-white/35">Affinità calcolata</p><p className="mt-2 text-lg font-bold">Avete risposte e vibrazioni in comune.</p></div></motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .48 }} className="mt-7"><button onClick={() => router.push(`/evento/${code}/chat/${match.id}`)} className="premium-cta flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-8 text-sm font-black uppercase tracking-[.12em]">Inizia la conversazione <span className="text-xl">↗</span></button><button onClick={() => router.push(`/evento/${code}/miei-match`)} className="mt-3 w-full rounded-full border border-white/10 bg-white/[.035] px-8 py-4 text-sm font-bold text-white/55 transition hover:bg-white/[.07] hover:text-white">Vedi tutti i match</button></motion.div>
        </div>
      </section>
    </main>
  )
}
