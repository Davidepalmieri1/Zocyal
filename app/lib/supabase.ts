import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.https://oftgclvzdgzdjzkzlqfg.supabase.co/rest/v1/!
const supabaseKey = process.env.sb_publishable_p3mlJx5ru2DT_-WT4Ay-5g_51T1IZ5D!

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)