import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

const UUID=/^[0-9a-f-]{36}$/i
const EVENT=/^[a-z0-9_-]{1,64}$/
const COUPON=/^[a-z0-9]{4,32}$/i

function privateJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  })
}

async function hasAdminSession() {
  const token=(await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token)
}

export async function GET(request:Request){
  if(!await hasAdminSession())return privateJson({error:"Accesso non valido."},401)
  const url=new URL(request.url)
  const eventCode=(url.searchParams.get("event_code")||"").trim().toLowerCase()
  const couponCode=(url.searchParams.get("coupon_code")||"").replace(/\s+/g,"").toUpperCase()
  if(!EVENT.test(eventCode)||!COUPON.test(couponCode))return privateJson({error:"Inserisci un codice coupon valido."},400)

  const supabase=getSupabaseAdmin()
  const couponResult=await supabase
    .from("drink_coupons")
    .select("offer_id,coupon_code")
    .eq("coupon_code",couponCode)
    .maybeSingle()
  if(couponResult.error)return privateJson({error:"Verifica non disponibile."},500)
  if(!couponResult.data)return privateJson({error:"Coupon non trovato per questo evento."},404)
  const coupon=couponResult.data as {offer_id:string;coupon_code:string}

  const offerResult=await supabase
    .from("drink_offers")
    .select("id,event_code,status,discount_cents")
    .eq("id",coupon.offer_id)
    .eq("event_code",eventCode)
    .maybeSingle()
  if(offerResult.error)return privateJson({error:"Verifica non disponibile."},500)
  if(!offerResult.data)return privateJson({error:"Coupon non trovato per questo evento."},404)
  const offer=offerResult.data as {id:string;event_code:string;status:string;discount_cents:number}

  return privateJson({
    coupon:{
      id:offer.id,
      coupon_code:coupon.coupon_code,
      event_code:offer.event_code,
      discount_cents:offer.discount_cents,
      status:offer.status,
    },
  })
}

export async function PATCH(request:Request){
  if(!await hasAdminSession())return privateJson({error:"Accesso non valido."},401)
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Richiesta non valida."},{status:403})
  let body:Record<string,unknown>;try{body=await request.json()}catch{return NextResponse.json({error:"Dati non validi."},{status:400})}
  const id=typeof body.id==="string"?body.id:"",code=typeof body.event_code==="string"?body.event_code.toLowerCase():""
  if(!UUID.test(id)||!code)return NextResponse.json({error:"Dati non validi."},{status:400})
  const {data,error}=await getSupabaseAdmin().from("drink_offers").update({status:"redeemed",redeemed_at:new Date().toISOString()} as never).eq("id",id).eq("event_code",code).eq("status","accepted").select("id").maybeSingle()
  if(error)return NextResponse.json({error:"Convalida non riuscita."},{status:500})
  return data?NextResponse.json({ok:true}):NextResponse.json({error:"Coupon già utilizzato o non valido."},{status:409})
}
