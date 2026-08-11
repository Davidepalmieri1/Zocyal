import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)

// Le informazioni generali dell'evento sono pubbliche e non devono dipendere
// dalla sessione partecipante eventualmente salvata nel browser.
export const publicSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "zocyal-public",
  },
})
