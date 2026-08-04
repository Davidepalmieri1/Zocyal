import {cookies} from "next/headers"
import {NextResponse} from "next/server"
import {ADMIN_SESSION_COOKIE,verifyAdminSessionToken,verifyDestructiveActionPassword} from "@/app/lib/admin-auth"
import {getSupabaseAdmin} from "@/app/lib/supabase-admin"

export const dynamic="force-dynamic"
export async function GET(){
  const token=(await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if(!verifyAdminSessionToken(token))return NextResponse.json({error:"Accesso non valido."},{status:401})
  const {data,error}=await getSupabaseAdmin().from("events").select("code,name,venue,status,experience_mode,starts_at,ends_at,venue_logo_url,venue_poster_url,updated_at").order("updated_at",{ascending:false}).limit(200)
  if(error)return NextResponse.json({error:"Impossibile caricare gli eventi."},{status:500})
  return NextResponse.json({events:data||[]},{headers:{"Cache-Control":"private, no-store"}})
}

export async function DELETE(request:Request){
  const token=(await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if(!verifyAdminSessionToken(token))return NextResponse.json({error:"Accesso non valido."},{status:401})
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Richiesta non valida."},{status:403})
  let code=""
  try{
    const body=await request.json()
    code=typeof body.code==="string"?body.code.trim().toLowerCase():""
    if(!verifyDestructiveActionPassword(body.password))return NextResponse.json({error:"Password di eliminazione errata."},{status:403})
  }catch{return NextResponse.json({error:"Dati non validi."},{status:400})}
  if(!/^[a-z0-9_-]{1,64}$/.test(code))return NextResponse.json({error:"Codice evento non valido."},{status:400})

  const db=getSupabaseAdmin()
  const {data:existing,error:readError}=await db.from("events").select("code").eq("code",code).maybeSingle()
  if(readError)return NextResponse.json({error:"Impossibile verificare l'evento."},{status:500})
  if(!existing)return NextResponse.json({error:"Evento non trovato."},{status:404})
  const {error}=await db.rpc("admin_delete_event",{p_event_code:code} as never)
  if(error){console.error("Eliminazione evento non riuscita:",error);return NextResponse.json({error:"Eliminazione non riuscita. Riprova."},{status:500})}

  const {data:files}=await db.storage.from("event-assets").list(code,{limit:1000})
  if(files?.length)await db.storage.from("event-assets").remove(files.map(file=>`${code}/${file.name}`))
  return NextResponse.json({deleted:true,code},{headers:{"Cache-Control":"private, no-store"}})
}
