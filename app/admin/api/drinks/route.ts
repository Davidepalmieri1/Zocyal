import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

const UUID=/^[0-9a-f-]{36}$/i
export async function PATCH(request:Request){
  const token=(await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if(!verifyAdminSessionToken(token))return NextResponse.json({error:"Accesso non valido."},{status:401})
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Richiesta non valida."},{status:403})
  let body:Record<string,unknown>;try{body=await request.json()}catch{return NextResponse.json({error:"Dati non validi."},{status:400})}
  const id=typeof body.id==="string"?body.id:"",code=typeof body.event_code==="string"?body.event_code.toLowerCase():""
  if(!UUID.test(id)||!code)return NextResponse.json({error:"Dati non validi."},{status:400})
  const {data,error}=await getSupabaseAdmin().from("drink_offers").update({status:"redeemed",redeemed_at:new Date().toISOString()} as never).eq("id",id).eq("event_code",code).eq("status","accepted").select("id").maybeSingle()
  if(error)return NextResponse.json({error:"Convalida non riuscita."},{status:500})
  return data?NextResponse.json({ok:true}):NextResponse.json({error:"Coupon già utilizzato o non valido."},{status:409})
}
