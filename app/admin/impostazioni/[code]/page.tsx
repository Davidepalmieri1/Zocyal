"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { QRCodeCanvas } from "qrcode.react"
import Sidebar from "@/app/admin/components/Sidebar"

type EventSettings={name:string;venue:string|null;code:string;description:string;starts_at:string|null;ends_at:string|null;timezone:string;status:"draft"|"open"|"closed";updated_at:string}
function localDate(value:string|null){if(!value)return "";const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function iso(value:string){return value?new Date(value).toISOString():null}

export default function SettingsPage(){
  const {code:raw}=useParams<{code:string}>(),code=raw.toLowerCase()
  const [event,setEvent]=useState<EventSettings|null>(null),[error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false)
  const [publicLink,setPublicLink]=useState("")
  const qrRef=useRef<HTMLDivElement>(null)
  const load=useCallback(async()=>{const response=await fetch(`/admin/api/settings?code=${encodeURIComponent(code)}`,{credentials:"same-origin",cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Impossibile caricare le impostazioni.");setEvent(data.event)},[code])
  useEffect(()=>{setPublicLink(`${window.location.origin}/evento/${code}`);void load().catch(e=>setError(e instanceof Error?e.message:"Errore inatteso."))},[load,code])

  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!event)return;setBusy(true);setError("");setSuccess("")
    const form=new FormData(e.currentTarget),status=String(form.get("status"))
    if(status==="closed"&&!window.confirm("Terminare l'evento? I nuovi partecipanti non potranno più entrare.")){setBusy(false);return}
    try{const response=await fetch("/admin/api/settings",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,name:form.get("name"),venue:form.get("venue"),description:form.get("description"),starts_at:iso(String(form.get("starts_at")||"")),ends_at:iso(String(form.get("ends_at")||"")),timezone:form.get("timezone"),status})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Salvataggio non riuscito.");setEvent(data.event);setSuccess("Impostazioni salvate correttamente.")}catch(e){setError(e instanceof Error?e.message:"Errore inatteso.")}finally{setBusy(false)}
  }

  function downloadQr(){const canvas=qrRef.current?.querySelector("canvas");if(!canvas)return;const anchor=document.createElement("a");anchor.download=`zocyal-${code}-qr.png`;anchor.href=canvas.toDataURL("image/png");anchor.click()}
  return <div className="flex min-h-screen bg-black text-white"><Sidebar/><main className="min-w-0 flex-1 px-4 pb-16 pt-20 lg:p-8"><div className="mx-auto max-w-4xl">
    <p className="text-xs font-black uppercase tracking-[.2em] text-pink-400">Gestione evento</p><h1 className="mt-2 text-4xl font-black">Impostazioni</h1>
    {error&&<p className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}{success&&<p className="mt-5 rounded-2xl border border-green-400/30 bg-green-400/10 p-4 text-green-200">{success}</p>}{!event&&!error&&<p className="mt-8 text-zinc-400">Caricamento...</p>}
    {event&&<form onSubmit={save} className="mt-7 grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/[.05] p-6"><h2 className="text-2xl font-black">Informazioni pubbliche</h2><label className="mt-5 block text-sm font-bold">Nome evento<input name="name" required minLength={3} defaultValue={event.name} className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label><label className="mt-4 block text-sm font-bold">Luogo<input name="venue" defaultValue={event.venue||""} className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label><label className="mt-4 block text-sm font-bold">Descrizione<textarea name="description" defaultValue={event.description||""} rows={4} className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label></section>
      <section className="rounded-3xl border border-white/10 bg-white/[.05] p-6"><h2 className="text-2xl font-black">Accesso e orari</h2><label className="mt-5 block text-sm font-bold">Codice evento<input readOnly value={event.code} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 p-3 text-zinc-300"/></label><p className="mt-2 text-xs text-zinc-500">Il codice è protetto perché è già collegato a profili, missioni, premi e QR.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Apertura<input name="starts_at" type="datetime-local" defaultValue={localDate(event.starts_at)} className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label><label className="text-sm font-bold">Chiusura<input name="ends_at" type="datetime-local" defaultValue={localDate(event.ends_at)} className="mt-2 w-full rounded-xl bg-white p-3 text-black"/></label></div><label className="mt-4 block text-sm font-bold">Fuso orario<select name="timezone" defaultValue={event.timezone||"Europe/Rome"} className="mt-2 w-full rounded-xl bg-white p-3 text-black"><option value="Europe/Rome">Italia · Europe/Rome</option></select></label><label className="mt-4 block text-sm font-bold">Stato<select name="status" defaultValue={event.status} className="mt-2 w-full rounded-xl bg-white p-3 text-black"><option value="draft">Bozza · ingressi chiusi</option><option value="open">Aperto · ingressi consentiti</option><option value="closed">Terminato · ingressi chiusi</option></select></label></section>
      <section className="rounded-3xl border border-white/10 bg-white/[.05] p-6"><div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-black uppercase tracking-[.18em] text-pink-400">Ingresso partecipanti</p><h2 className="mt-2 text-2xl font-black">Link e QR Code</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Mostra il QR all&apos;ingresso o stampalo: apre direttamente la pagina dell&apos;evento.</p><p className="mt-4 break-all rounded-xl bg-black/40 p-4 text-sm text-pink-300">{publicLink||`/evento/${code}`}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>void navigator.clipboard.writeText(publicLink).then(()=>setSuccess("Link copiato."))} className="rounded-xl border border-pink-400/30 px-4 py-3 font-black text-pink-200">COPIA LINK</button><button type="button" onClick={downloadQr} className="rounded-xl bg-white px-4 py-3 font-black text-black">SCARICA QR</button></div></div>{publicLink&&<div ref={qrRef} className="mx-auto rounded-3xl bg-white p-5"><QRCodeCanvas value={publicLink} size={210} level="H" marginSize={1} aria-label={`QR Code evento ${event.name}`}/><p className="mt-3 max-w-[210px] text-center text-sm font-black text-black">{event.name}<br/><span className="text-xs font-bold text-zinc-500">Codice: {event.code}</span></p></div>}</div></section>
      <button disabled={busy} className="rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 text-lg font-black disabled:opacity-60">{busy?"SALVATAGGIO...":"SALVA IMPOSTAZIONI"}</button>
    </form>}
  </div></main></div>
}
