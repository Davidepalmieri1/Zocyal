import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic = "force-dynamic"
const EVENT = /^[a-z0-9_-]{1,64}$/
const STATES = new Set(["draft", "open", "closed"])
const EXPERIENCE_MODES = new Set(["standard", "inclusive", "caribbean"])
const IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]])
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}
async function authenticated(){return verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value)}
function clean(value:unknown,max:number){return typeof value==="string"?value.trim().slice(0,max):""}
function date(value:unknown){if(value===null||value===""||value===undefined)return null;const parsed=new Date(String(value));return Number.isNaN(parsed.getTime())?undefined:parsed.toISOString()}
function image(value:FormDataEntryValue|null,maxSize:number){
  if(!(value instanceof File)||value.size===0)return null
  if(!IMAGE_TYPES.has(value.type)||value.size>maxSize)return undefined
  return value
}

export async function GET(request:Request){
  if(!(await authenticated()))return reply({error:"Accesso non valido."},401)
  const code=new URL(request.url).searchParams.get("code")?.trim().toLowerCase()||""
  if(!EVENT.test(code))return reply({error:"Codice non valido."},400)
  const {data,error}=await getSupabaseAdmin().from("events").select("name,venue,code,description,starts_at,ends_at,timezone,status,experience_mode,venue_logo_url,venue_poster_url,updated_at").eq("code",code).maybeSingle()
  if(error)return reply({error:"Impossibile caricare le impostazioni."},500)
  return data?reply({event:data}):reply({error:"Evento non trovato."},404)
}

export async function PATCH(request:Request){
  if(!(await authenticated()))return reply({error:"Accesso non valido."},401)
  if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Richiesta non valida."},403)
  let body:Record<string,unknown>,logo:File|null|undefined=null,poster:File|null|undefined=null
  try{
    if(request.headers.get("content-type")?.includes("multipart/form-data")){
      const form=await request.formData()
      body=Object.fromEntries(form.entries())
      logo=image(form.get("venue_logo"),1024*1024)
      poster=image(form.get("venue_poster"),3*1024*1024)
      if(logo===undefined||poster===undefined)return reply({error:"Usa immagini JPG, PNG o WebP. Logo massimo 3 MB, locandina massimo 8 MB."},400)
    }else body=await request.json()
  }catch{return reply({error:"Dati non validi."},400)}
  const code=clean(body.code,64).toLowerCase(),name=clean(body.name,100),venue=clean(body.venue,160),description=clean(body.description,1000),timezone=clean(body.timezone,60)||"Europe/Rome",status=clean(body.status,20),startsAt=date(body.starts_at),endsAt=date(body.ends_at)
  if(!EVENT.test(code)||name.length<3||!STATES.has(status)||startsAt===undefined||endsAt===undefined)return reply({error:"Controlla i campi inseriti."},400)
  if(startsAt&&endsAt&&new Date(startsAt)>=new Date(endsAt))return reply({error:"La chiusura deve essere successiva all'apertura."},400)
  const db=getSupabaseAdmin()
  const current=await db.from("events").select("venue_logo_url,venue_poster_url").eq("code",code).maybeSingle()
  if(current.error)return reply({error:"Salvataggio non riuscito."},500)
  if(!current.data)return reply({error:"Evento non trovato."},404)
  const uploaded:string[]=[],assets:Record<string,string>={}
  try{
    for(const [kind,file] of [["logo",logo],["poster",poster]] as const){
      if(!file)continue
      const path=`${code}/${kind}-${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`
      const {error:uploadError}=await db.storage.from("event-assets").upload(path,file,{contentType:file.type,upsert:false})
      if(uploadError)throw uploadError
      uploaded.push(path)
      assets[kind]=db.storage.from("event-assets").getPublicUrl(path).data.publicUrl
    }
    const changes:Record<string,unknown>={name,venue:venue||null,description,timezone,status,starts_at:startsAt,ends_at:endsAt,updated_at:new Date().toISOString()}
    if(assets.logo)changes.venue_logo_url=assets.logo
    if(assets.poster)changes.venue_poster_url=assets.poster
    const {data,error}=await db.from("events").update(changes as never).eq("code",code).select("name,venue,code,description,starts_at,ends_at,timezone,status,experience_mode,venue_logo_url,venue_poster_url,updated_at").maybeSingle()
    if(error)throw error
    if(!data)throw new Error("Evento non trovato")
    const oldUrls=[assets.logo?(current.data as {venue_logo_url:string|null}).venue_logo_url:null,assets.poster?(current.data as {venue_poster_url:string|null}).venue_poster_url:null]
    const oldPaths=oldUrls.flatMap(url=>{if(!url)return[];try{const marker="/event-assets/",index=new URL(url).pathname.indexOf(marker);const path=index>=0?decodeURIComponent(new URL(url).pathname.slice(index+marker.length)):"";return path.startsWith(`${code}/`)?[path]:[]}catch{return[]}})
    if(oldPaths.length)await db.storage.from("event-assets").remove(oldPaths)
    return reply({event:data})
  }catch(uploadError){
    if(uploaded.length)await db.storage.from("event-assets").remove(uploaded)
    console.error("Aggiornamento immagini evento non riuscito:",uploadError)
    return reply({error:"Non siamo riusciti a salvare logo o locandina. Riprova."},500)
  }
}

export async function POST(request:Request){
  if(!(await authenticated()))return reply({error:"Accesso non valido."},401)
  if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Richiesta non valida."},403)
  let body:Record<string,unknown>,logo:File|null|undefined=null,poster:File|null|undefined=null
  try{
    if(request.headers.get("content-type")?.includes("multipart/form-data")){
      const form=await request.formData()
      body=Object.fromEntries(form.entries())
      logo=image(form.get("venue_logo"),1024*1024)
      poster=image(form.get("venue_poster"),3*1024*1024)
      if(logo===undefined||poster===undefined)return reply({error:"Usa immagini JPG, PNG o WebP. Logo massimo 1 MB, locandina massimo 3 MB."},400)
    }else body=await request.json()
  }catch{return reply({error:"Dati non validi."},400)}
  const code=clean(body.code,24).toLowerCase(),name=clean(body.name,100),venue=clean(body.venue,160),description=clean(body.description,1000),timezone=clean(body.timezone,60)||"Europe/Rome",experienceMode=clean(body.experience_mode,20)||"standard",startsAt=date(body.starts_at),endsAt=date(body.ends_at)
  if(!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(code)||name.length<3||!EXPERIENCE_MODES.has(experienceMode)||startsAt===undefined||endsAt===undefined)return reply({error:"Controlla nome, codice, tipo di esperienza e orari."},400)
  if(startsAt&&endsAt&&new Date(startsAt)>=new Date(endsAt))return reply({error:"La chiusura deve essere successiva all'apertura."},400)
  const db=getSupabaseAdmin()
  const {data,error}=await db.from("events").insert({code,name,venue:venue||null,description,timezone,experience_mode:experienceMode,starts_at:startsAt,ends_at:endsAt,status:"draft",updated_at:new Date().toISOString()} as never).select("code,name,status,experience_mode").single()
  if(error){if(error.code==="23505")return reply({error:"Questo codice evento è già utilizzato."},409);return reply({error:"Creazione evento non riuscita."},500)}

  const uploaded:string[]=[]
  try{
    const assets:Record<string,string>={}
    for(const [kind,file] of [["logo",logo],["poster",poster]] as const){
      if(!file)continue
      const path=`${code}/${kind}-${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`
      const {error:uploadError}=await db.storage.from("event-assets").upload(path,file,{contentType:file.type,upsert:false})
      if(uploadError)throw uploadError
      uploaded.push(path)
      assets[kind]=db.storage.from("event-assets").getPublicUrl(path).data.publicUrl
    }
    if(Object.keys(assets).length){
      const {error:updateError}=await db.from("events").update({venue_logo_url:assets.logo||null,venue_poster_url:assets.poster||null} as never).eq("code",code)
      if(updateError)throw updateError
    }
    return reply({event:{...(data as Record<string,unknown>),venue_logo_url:assets.logo||null,venue_poster_url:assets.poster||null}},201)
  }catch(uploadError){
    if(uploaded.length)await db.storage.from("event-assets").remove(uploaded)
    await db.from("events").delete().eq("code",code)
    console.error("Caricamento immagini evento non riuscito:",uploadError)
    return reply({error:"Non siamo riusciti a caricare logo o locandina. L'evento non è stato creato: riprova."},500)
  }
}
