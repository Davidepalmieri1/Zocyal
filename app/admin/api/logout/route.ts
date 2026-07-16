import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE } from "@/app/lib/admin-auth"

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303)

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(0),
    path: "/admin",
  })

  return response
}
