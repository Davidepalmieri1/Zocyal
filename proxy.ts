import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/app/lib/admin-auth"

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/api/login"])

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const authenticated = verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  )

  if (authenticated) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/admin/login", request.url)

  if (request.method === "GET" || request.method === "HEAD") {
    loginUrl.searchParams.set("next", `${pathname}${search}`)
  }

  return NextResponse.redirect(loginUrl, 303)
}

export const config = {
  matcher: ["/admin/:path*"],
}
