"use client"

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { useParams, useRouter } from "next/navigation"
import { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import Logo from "@/app/components/Logo"

type Messaggio = {
  id: string
  match_id: string
  sender_id: string
  message: string
  created_at: string
}

type Persona = {
  id: string
  nickname: string | null
  avatar_url: string | null
  age: number | null
  goal: string | null
}

function creaSuggerimenti(persona: Persona | null) {
  const nome = persona?.nickname || "te"

  switch (persona?.goal) {
    case "Divertirmi":
      return [
        "Qual è la canzone che ti fa correre subito in pista? 🎶",
        "Da 1 a 10, quanto sei in modalità festa stasera? 😄",
        "Qual è stata la parte più divertente della serata finora?",
      ]

    case "Socializzare":
      return [
        `Ciao ${nome}, con chi sei venuto/a stasera? 👋`,
        "Qual è il modo migliore per rompere il ghiaccio con te?",
        "Ti va di fare due chiacchiere dal vivo più tardi?",
      ]

    case "Trovare una connessione":
      return [
        `Ciao ${nome}, cosa ti ha incuriosito del mio profilo?`,
        "Qual è la caratteristica che apprezzi di più in una persona? ❤️",
        "Preferisci conoscerci qui oppure parlare dal vivo?",
      ]

    case "Missioni e premi":
      return [
        "Ti va di completare una missione insieme? 🎯",
        "Facciamo squadra e proviamo a vincere qualcosa?",
        "Quale sfida sceglieresti per rompere il ghiaccio?",
      ]

    default:
      return [
        `Ciao ${nome}, come sta andando la tua serata? 😊`,
        "Qual è stata la cosa più bella della serata finora?",
        "Ti va di conoscerci meglio?",
      ]
  }
}

export default function ChatPage() {
  const params = useParams<{
    code: string
    match_id: string
  }>()

  const router = useRouter()

  const matchId = params.match_id
  const eventCode = params.code

  const [messages, setMessages] = useState<Messaggio[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [typing, setTyping] = useState(false)
  const [errore, setErrore] = useState("")
  const [mioId, setMioId] = useState<string | null>(null)
  const [profiloControllato, setProfiloControllato] =
    useState(false)

  const [notificheAttive, setNotificheAttive] =
    useState(false)

  const [permessoNotifiche, setPermessoNotifiche] =
    useState<NotificationPermission | "unsupported">(
      "unsupported"
    )

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const notificheAttiveRef = useRef(false)
  const personaRef = useRef<Persona | null>(null)

  const typingTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const suggerimenti = creaSuggerimenti(persona)

  useEffect(() => {
    personaRef.current = persona
  }, [persona])

  useEffect(() => {
    notificheAttiveRef.current = notificheAttive
  }, [notificheAttive])

  useEffect(() => {
    const participantId =
      localStorage.getItem("participant_id")

    const notificheSalvate =
      localStorage.getItem("zocyal_chat_notifications")

    setMioId(participantId)
    setProfiloControllato(true)

    if ("Notification" in window) {
      setPermessoNotifiche(Notification.permission)

      const devonoEssereAttive =
        notificheSalvate === "true"

      setNotificheAttive(devonoEssereAttive)
      notificheAttiveRef.current = devonoEssereAttive
    } else {
      setPermessoNotifiche("unsupported")
    }

    if (!participantId) {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [messages, typing])

  function riproduciSuonoNotifica() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext

      if (!AudioContextClass) {
        return
      }

      if (!audioContextRef.current) {
        audioContextRef.current =
          new AudioContextClass()
      }

      const audioContext = audioContextRef.current

      if (audioContext.state === "suspended") {
        audioContext.resume()
      }

      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(
        660,
        audioContext.currentTime
      )

      oscillator.frequency.exponentialRampToValueAtTime(
        880,
        audioContext.currentTime + 0.12
      )

      gain.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
      )

      gain.gain.exponentialRampToValueAtTime(
        0.18,
        audioContext.currentTime + 0.02
      )

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.28
      )

      oscillator.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.error(
        "Errore riproduzione suono:",
        error
      )
    }
  }

  function mostraNotificaMessaggio(
    nuovoMessaggio: Messaggio
  ) {
    if (!notificheAttiveRef.current) {
      return
    }

    riproduciSuonoNotifica()

    if ("vibrate" in navigator) {
      navigator.vibrate([120, 60, 120])
    }

    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      const mittente =
        personaRef.current?.nickname || "Nuovo match"

      const corpo =
        nuovoMessaggio.message.length > 90
          ? `${nuovoMessaggio.message.slice(0, 90)}…`
          : nuovoMessaggio.message

      const notifica = new Notification(
        `Nuovo messaggio da ${mittente}`,
        {
          body: corpo,
          icon:
            personaRef.current?.avatar_url ||
            "/logo-zocyal.svg",
          tag: `zocyal-chat-${matchId}`,
        }
      )

      notifica.onclick = () => {
        window.focus()
        notifica.close()
      }
    }
  }

  async function cambiaStatoNotifiche() {
    setErrore("")

    if (notificheAttive) {
      setNotificheAttive(false)
      notificheAttiveRef.current = false

      localStorage.setItem(
        "zocyal_chat_notifications",
        "false"
      )

      return
    }

    if (!("Notification" in window)) {
      setErrore(
        "Questo browser non supporta le notifiche."
      )
      return
    }

    let permesso = Notification.permission

    if (permesso === "default") {
      permesso = await Notification.requestPermission()
    }

    setPermessoNotifiche(permesso)

    if (permesso === "denied") {
      setNotificheAttive(true)
      notificheAttiveRef.current = true

      localStorage.setItem(
        "zocyal_chat_notifications",
        "true"
      )

      riproduciSuonoNotifica()

      setErrore(
        "Notifiche di sistema non disponibili. Suono e vibrazione restano attivi mentre Zocyal è aperto."
      )

      return
    }

    setNotificheAttive(true)
    notificheAttiveRef.current = true

    localStorage.setItem(
      "zocyal_chat_notifications",
      "true"
    )

    riproduciSuonoNotifica()
  }

  useEffect(() => {
    if (!matchId || !mioId) {
      return
    }

    async function caricaChat() {
      setLoading(true)
      setErrore("")

      const {
        data: messaggi,
        error: messaggiError,
      } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", {
          ascending: true,
        })

      if (messaggiError) {
        console.error(
          "Errore caricamento messaggi:",
          messaggiError
        )

        setErrore(
          "Non siamo riusciti a caricare i messaggi."
        )
      }

      setMessages((messaggi || []) as Messaggio[])

      const {
        data: match,
        error: matchError,
      } = await supabase
        .from("matches")
        .select("id, user_one, user_two")
        .eq("id", matchId)
        .maybeSingle()

      if (matchError) {
        console.error(
          "Errore caricamento match:",
          matchError
        )

        setErrore(
          "Non siamo riusciti a caricare questa chat."
        )

        setLoading(false)
        return
      }

      if (!match) {
        setErrore("Questa chat non esiste più.")
        setLoading(false)
        return
      }

      const appartieneAllaChat =
        match.user_one === mioId ||
        match.user_two === mioId

      if (!appartieneAllaChat) {
        setErrore(
          "Non hai accesso a questa conversazione."
        )

        setLoading(false)
        return
      }

      const altroId =
        match.user_one === mioId
          ? match.user_two
          : match.user_one

      const {
        data: profilo,
        error: profiloError,
      } = await supabase
        .from("participants")
        .select(
          "id, nickname, avatar_url, age, goal"
        )
        .eq("id", altroId)
        .maybeSingle()

      if (profiloError) {
        console.error(
          "Errore caricamento profilo:",
          profiloError
        )
      }

      const personaCaricata =
        profilo as Persona | null

      setPersona(personaCaricata)
      personaRef.current = personaCaricata
      setLoading(false)
    }

    caricaChat()

    const channel = supabase
      .channel(`chat-${matchId}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const nuovoMessaggio =
            payload.new as Messaggio

          setMessages((attuali) => {
            const giaPresente = attuali.some(
              (messaggio) =>
                messaggio.id === nuovoMessaggio.id
            )

            if (giaPresente) {
              return attuali
            }

            return [...attuali, nuovoMessaggio]
          })

          if (nuovoMessaggio.sender_id !== mioId) {
            mostraNotificaMessaggio(nuovoMessaggio)
          }
        }
      )

      .on(
        "broadcast",
        {
          event: "typing",
        },
        (payload) => {
          const dati = payload.payload as {
            user?: string
            status?: boolean
          }

          if (dati.user !== mioId) {
            setTyping(Boolean(dati.status))
          }
        }
      )

      .subscribe()

    channelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [matchId, mioId])

  async function mandaTyping(status: boolean) {
    if (!mioId || !channelRef.current) {
      return
    }

    await channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user: mioId,
        status,
      },
    })
  }

  function stoScrivendo() {
    mandaTyping(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      mandaTyping(false)
    }, 1500)
  }

  function usaSuggerimento(suggerimento: string) {
    setText(suggerimento)
    setErrore("")

    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  async function inviaMessaggio(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault()

    const messaggioPulito = text.trim()

    if (!messaggioPulito || !mioId || sending) {
      return
    }

    setSending(true)
    setErrore("")

    await mandaTyping(false)

    const { error } = await supabase
      .from("messages")
      .insert({
        match_id: matchId,
        sender_id: mioId,
        message: messaggioPulito,
      })

    if (error) {
      console.error(
        "Errore invio messaggio:",
        error
      )

      setErrore(
        "Non siamo riusciti a inviare il messaggio."
      )

      setSending(false)
      return
    }

    setText("")
    setSending(false)
  }

  function gestisciTasto(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      inviaMessaggio()
    }
  }

  if (profiloControllato && !mioId) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative w-full max-w-md text-center">
          <Logo size="medium" />

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-8 backdrop-blur-xl">
            <span className="text-5xl">🔒</span>

            <h1 className="mt-5 text-2xl font-black">
              Profilo non trovato
            </h1>

            <p className="mt-3 leading-7 text-gray-400">
              Rientra nell’evento per accedere alla chat.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(`/evento/${eventCode}`)
              }
              className="mt-7 w-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 font-black text-white"
            >
              TORNA ALL’EVENTO
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="relative text-center">
          <Logo size="medium" />

          <div className="mx-auto mt-10 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-pink-500" />

          <h1 className="mt-6 text-2xl font-black">
            Carico la chat
          </h1>

          <p className="mt-3 text-gray-400">
            Prepariamo la vostra conversazione.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[130px]" />

      <div className="pointer-events-none absolute bottom-[-220px] right-[-160px] h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[120px]" />

      <header className="relative z-20 border-b border-white/10 bg-black/75 px-4 py-4 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Torna indietro"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
          >
            ‹
          </button>

          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-pink-500/30 blur-lg" />

            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-900">
              {persona?.avatar_url ? (
                <img
                  src={persona.avatar_url}
                  alt={
                    persona.nickname ||
                    "Partecipante"
                  }
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl">
                  👤
                </span>
              )}
            </div>

            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-black bg-green-400" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">
              {persona?.nickname || "Chat"}
            </h1>

            {typing ? (
              <p className="mt-1 text-xs font-bold text-pink-400">
                Sta scrivendo...
              </p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-green-400">
                Online
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={cambiaStatoNotifiche}
            aria-label={
              notificheAttive
                ? "Disattiva notifiche"
                : "Attiva notifiche"
            }
            title={
              notificheAttive
                ? "Notifiche attive"
                : "Notifiche disattivate"
            }
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl transition ${
              notificheAttive
                ? "border-pink-400/50 bg-pink-500/15 text-white shadow-[0_0_24px_rgba(236,72,153,0.22)]"
                : "border-white/10 bg-white/[0.05] text-gray-400 hover:border-pink-400/30 hover:text-white"
            }`}
          >
            {notificheAttive ? "🔔" : "🔕"}

            {notificheAttive && (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-black bg-green-400" />
            )}
          </button>

          <div className="hidden sm:block">
            <Logo size="small" />
          </div>
        </div>
      </header>

      <section className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <div className="mb-4 text-center">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 backdrop-blur">
              Nuovo match
            </span>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-500">
              Avete mostrato interesse reciproco. Il resto
              della storia è tutto da scrivere.
            </p>

            {!notificheAttive && (
              <button
                type="button"
                onClick={cambiaStatoNotifiche}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-300 transition hover:border-pink-400/50 hover:bg-pink-500/15"
              >
                <span>🔔</span>
                Attiva avvisi messaggi
              </button>
            )}

            {notificheAttive && (
              <p className="mt-4 text-xs font-semibold text-green-400">
                🔔 Avvisi messaggi attivi
              </p>
            )}
          </div>

          {messages.length === 0 && (
            <div className="my-auto py-10 text-center">
              <span className="text-5xl">💬</span>

              <h2 className="mt-5 text-xl font-black">
                Rompi il ghiaccio
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Usa uno dei suggerimenti in basso oppure
                scrivi qualcosa di tuo.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const mioMessaggio =
              msg.sender_id === mioId

            return (
              <div
                key={msg.id}
                className={`flex ${
                  mioMessaggio
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-lg sm:max-w-[70%] ${
                    mioMessaggio
                      ? "rounded-br-md bg-gradient-to-br from-fuchsia-600 via-pink-500 to-orange-400 text-white shadow-pink-500/10"
                      : "rounded-bl-md border border-white/10 bg-white/[0.08] text-white backdrop-blur-xl"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6">
                    {msg.message}
                  </p>

                  <span
                    className={`mt-1.5 block text-right text-[10px] ${
                      mioMessaggio
                        ? "text-white/70"
                        : "text-gray-500"
                    }`}
                  >
                    {new Date(
                      msg.created_at
                    ).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            )
          })}

          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.08] px-5 py-4">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      <footer className="relative z-20 border-t border-white/10 bg-black/80 px-4 py-4 backdrop-blur-2xl">
        <div className="mx-auto w-full max-w-3xl">
          {errore && (
            <p className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-xs leading-5 text-red-300">
              {errore}
            </p>
          )}

          {permessoNotifiche === "denied" && (
            <p className="mb-3 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-center text-xs leading-5 text-orange-200">
              Le notifiche del browser sono bloccate. Il suono
              può comunque funzionare dopo aver interagito con
              la pagina.
            </p>
          )}

          <div className="mb-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Rompi il ghiaccio
              </p>

              {persona?.goal && (
                <span className="max-w-[190px] truncate rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1.5 text-[10px] font-bold text-pink-300">
                  {persona.goal}
                </span>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {suggerimenti.map((suggerimento) => (
                <button
                  key={suggerimento}
                  type="button"
                  onClick={() =>
                    usaSuggerimento(suggerimento)
                  }
                  className="max-w-[260px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-xs font-semibold leading-5 text-gray-300 transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-white"
                >
                  {suggerimento}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={inviaMessaggio}
            className="flex items-center gap-3"
          >
            <input
              ref={inputRef}
              value={text}
              maxLength={1000}
              onChange={(event) => {
                setText(event.target.value)
                setErrore("")
                stoScrivendo()
              }}
              onKeyDown={gestisciTasto}
              placeholder="Scrivi un messaggio..."
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.07] px-5 py-4 text-sm font-medium text-white outline-none transition placeholder:text-gray-500 focus:border-pink-400/50 focus:bg-white/[0.1] focus:ring-4 focus:ring-pink-500/10"
            />

            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label="Invia messaggio"
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 text-xl font-black text-white shadow-[0_0_30px_rgba(236,72,153,0.25)] transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <span className="-rotate-12">
                  ➤
                </span>
              )}
            </button>
          </form>
        </div>
      </footer>
    </main>
  )
}