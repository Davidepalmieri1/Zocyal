import "server-only"

import { createClient } from "@supabase/supabase-js"

let adminClient: ReturnType<typeof createClient> | undefined

export function getSupabaseAdmin() {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()

  if (!url || !secretKey) {
    throw new Error("Supabase admin non configurato")
  }

  adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
