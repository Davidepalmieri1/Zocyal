import { createHmac, timingSafeEqual } from "node:crypto"

export const ADMIN_SESSION_COOKIE = "zocyal_admin_session"
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || ""
}

function sign(value: string) {
  const secret = getSessionSecret()

  if (!secret) return ""

  return createHmac("sha256", secret).update(value).digest("hex")
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

export function isAdminAuthConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD?.trim() && getSessionSecret().length >= 32
  )
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD || ""

  return Boolean(expected) && safeEqual(password, expected)
}

export function createAdminSessionToken() {
  if (!isAdminAuthConfigured()) return ""

  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS
  const payload = String(expiresAt)

  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token?: string) {
  if (!token || !isAdminAuthConfigured()) return false

  const [expiresAt, signature, extra] = token.split(".")

  if (!expiresAt || !signature || extra) return false

  const expiresAtNumber = Number(expiresAt)

  if (
    !Number.isSafeInteger(expiresAtNumber) ||
    expiresAtNumber <= Math.floor(Date.now() / 1000)
  ) {
    return false
  }

  return safeEqual(signature, sign(expiresAt))
}
