import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/app/lib/admin-auth"
import { getSupabaseAdmin } from "@/app/lib/supabase-admin"

export const dynamic="force-dynamic"
const EVENT=/^[a-z0-9_-]{1,64}$/
export async function GET(request:Request){
  const token=(await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if(!verifyAdminSessionToken(token))return NextResponse.json({error:"Accesso non valido."},{status:401})
  const url=new URL(request.url),code=(url.searchParams.get("code")||"").toLowerCase(),raw=(url.searchParams.get("q")||"").trim().slice(0,80),q=raw.replace(/[%_,()]/g,"")
  if(!EVENT.test(code)||q.length<2)return NextResponse.json({results:[]},{headers:{"Cache-Control":"private, no-store"}})
  const supabase=getSupabaseAdmin(),pattern=`%${q}%`
  const [peopleResult,missionsResult,rewardsResult,offersResult]=await Promise.all([
    supabase.from("participants").select("id,nickname,age,goal").eq("event_code",code).ilike("nickname",pattern).limit(20),
    supabase.from("missions").select("id,title,points,active").eq("event_code",code).ilike("title",pattern).limit(15),
    supabase.from("rewards").select("id,name,reward_type,active").eq("event_code",code).ilike("name",pattern).limit(15),
    supabase.from("drink_offers").select("id,sender_id,receiver_id,status").eq("event_code",code).limit(1000),
  ])
  const failed=[peopleResult,missionsResult,rewardsResult,offersResult].find(result=>result.error)
  if(failed?.error)return NextResponse.json({error:"Ricerca non disponibile."},{status:500})
  const offers=(offersResult.data||[]) as {id:string;sender_id:string;receiver_id:string;status:string}[],offerIds=offers.map(offer=>offer.id)
  const couponResult=offerIds.length?await supabase.from("drink_coupons").select("offer_id,coupon_code").in("offer_id",offerIds).ilike("coupon_code",pattern).limit(20):{data:[],error:null}
  if(couponResult.error)return NextResponse.json({error:"Ricerca non disponibile."},{status:500})
  const personIds=[...new Set(offers.flatMap(offer=>[offer.sender_id,offer.receiver_id]))]
  const namesResult=personIds.length?await supabase.from("participants").select("id,nickname").in("id",personIds):{data:[],error:null}
  const names=new Map(((namesResult.data||[]) as {id:string;nickname:string|null}[]).map(person=>[person.id,person.nickname||"Partecipante"]))
  const offerById=new Map(offers.map(offer=>[offer.id,offer]))
  const results=[
    ...((peopleResult.data||[]) as {id:string;nickname:string|null;age:number|null;goal:string|null}[]).map(person=>({kind:"participant",title:person.nickname||"Partecipante",subtitle:[person.age?`${person.age} anni`:"",person.goal||""].filter(Boolean).join(" · "),href:`/admin/partecipanti/${code}`})),
    ...((couponResult.data||[]) as {offer_id:string;coupon_code:string}[]).map(coupon=>{const offer=offerById.get(coupon.offer_id);return {kind:"coupon",title:coupon.coupon_code,subtitle:offer?`${names.get(offer.sender_id)} → ${names.get(offer.receiver_id)} · ${offer.status}`:"Coupon drink",offerId:coupon.offer_id,status:offer?.status}}),
    ...((rewardsResult.data||[]) as {id:string;name:string;reward_type:string;active:boolean}[]).map(reward=>({kind:"reward",title:reward.name,subtitle:`Premio · ${reward.active?"attivo":"spento"}`,href:`/admin/premi/${code}`})),
    ...((missionsResult.data||[]) as {id:string;title:string;points:number;active:boolean}[]).map(mission=>({kind:"mission",title:mission.title,subtitle:`Missione · ${mission.points} punti · ${mission.active?"attiva":"spenta"}`,href:`/admin/premi/${code}`})),
  ]
  return NextResponse.json({results},{headers:{"Cache-Control":"private, no-store"}})
}
