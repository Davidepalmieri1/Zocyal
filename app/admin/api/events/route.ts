import {cookies} from "next/headers"
import {NextResponse} from "next/server"
import {ADMIN_SESSION_COOKIE,verifyAdminSessionToken} from "@/app/lib/admin-auth"
import {getSupabaseAdmin} from "@/app/lib/supabase-admin"

export const dynamic="force-dynamic"
export async function GET(){
  const token=(await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if(!verifyAdminSessionToken(token))return NextResponse.json({error:"Accesso non valido."},{status:401})
  const {data,error}=await getSupabaseAdmin().from("events").select("code,name,venue,status,starts_at,ends_at,updated_at").order("updated_at",{ascending:false}).limit(200)
  if(error)return NextResponse.json({error:"Impossibile caricare gli eventi."},{status:500})
  return NextResponse.json({events:data||[]},{headers:{"Cache-Control":"private, no-store"}})
}
