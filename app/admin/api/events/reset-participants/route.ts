import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
  verifyDestructiveActionPassword,
} from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "Accesso non valido." }, { status: 401 })
  }

  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 403 })
  }

  let code = ""
  try {
    const body = await request.json()
    code = typeof body.code === "string" ? body.code.trim().toLowerCase() : ""
    if (!verifyDestructiveActionPassword(body.password)) {
      return NextResponse.json({ error: "Password di sicurezza errata." }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 })
  }

  if (!/^[a-z0-9_-]{1,64}$/.test(code)) {
    return NextResponse.json({ error: "Codice evento non valido." }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const { data: existing, error: readError } = await db
    .from("events")
    .select("code")
    .eq("code", code)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: "Impossibile verificare l'evento." }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Evento non trovato." }, { status: 404 })

  const { data, error } = await db.rpc("admin_reset_event_participants", {
    p_event_code: code,
  } as never)

  if (error) {
    console.error("Pulizia partecipanti evento non riuscita:", error)
    return NextResponse.json(
      { error: "Pulizia non riuscita. Verifica di aver applicato la nuova migrazione SQL." },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { reset: true, code, deletedParticipants: Number(data) || 0 },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
