import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"
const EVENT = /^[a-z0-9_-]{1,64}$/
const STATES = new Set(["draft", "open", "closed"])
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}
async function authenticated(){return verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value)}
function clean(value:unknown,max:number){return typeof value==="string"?value.trim().slice(0,max):""}
function date(value:unknown){if(value===null||value===""||value===undefined)return null;const parsed=new Date(String(value));return Number.isNaN(parsed.getTime())?undefined:parsed.toISOString()}

export async function GET(request:Request){
  if(!(await authenticated()))return reply({error:"Accesso non valido."},401)
  const code=new URL(request.url).searchParams.get("code")?.trim().toLowerCase()||""
  if(!EVENT.test(code))return reply({error:"Codice non valido."},400)
  const {data,error}=await getSupabaseAdmin().from("events").select("name,venue,code,description,starts_at,ends_at,timezone,status,updated_at").eq("code",code).maybeSingle()
  if(error)return reply({error:"Impossibile caricare le impostazioni."},500)
  return data?reply({event:data}):reply({error:"Evento non trovato."},404)
}

export async function PATCH(request:Request){
  if(!(await authenticated()))return reply({error:"Accesso non valido."},401)
  if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Richiesta non valida."},403)
  let body:Record<string,unknown>;try{body=await request.json()}catch{return reply({error:"Dati non validi."},400)}
  const code=clean(body.code,64).toLowerCase(),name=clean(body.name,100),venue=clean(body.venue,160),description=clean(body.description,1000),timezone=clean(body.timezone,60)||"Europe/Rome",status=clean(body.status,20),startsAt=date(body.starts_at),endsAt=date(body.ends_at)
  if(!EVENT.test(code)||name.length<3||!STATES.has(status)||startsAt===undefined||endsAt===undefined)return reply({error:"Controlla i campi inseriti."},400)
  if(startsAt&&endsAt&&new Date(startsAt)>=new Date(endsAt))return reply({error:"La chiusura deve essere successiva all'apertura."},400)
  const {data,error}=await getSupabaseAdmin().from("events").update({name,venue:venue||null,description,timezone,status,starts_at:startsAt,ends_at:endsAt,updated_at:new Date().toISOString()} as never).eq("code",code).select("name,venue,code,description,starts_at,ends_at,timezone,status,updated_at").maybeSingle()
  if(error)return reply({error:"Salvataggio non riuscito."},500)
  return data?reply({event:data}):reply({error:"Evento non trovato."},404)
}
