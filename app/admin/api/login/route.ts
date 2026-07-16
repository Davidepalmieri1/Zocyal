import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminSessionToken,
  isAdminAuthConfigured,
  verifyAdminPassword,
} from "@/app/lib/admin-auth"

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: "Accesso amministratore non configurato." },
      { status: 503 }
    )
  }

  let body: { password?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 })
  }

  const password = typeof body.password === "string" ? body.password : ""

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Password non corretta." }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_SECONDS,
    path: "/admin",
  })

  return response
}
