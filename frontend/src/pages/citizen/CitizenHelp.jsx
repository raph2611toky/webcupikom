import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { sendContactMessage } from "../../api/contact.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";

const COPY={
  fr:{eyebrow:"Relations citoyennes",title:"Nous contacter",messages:"Mes messages",help:"Besoin d’aide",headline:"Écrivez directement à la ville.",intro:<>Une question, une difficulté ou un besoin d’accompagnement ? Envoyez un message au service concerné. Vous pourrez ensuite retrouver son suivi dans <b>Mes messages</b>.</>,steps:["Choisissez le service concerné.","Décrivez votre besoin simplement.","Conservez la référence de confirmation."],sent:"Message envoyé",sentText:"Votre message a bien été transmis à Nova Terra.",newMessage:"Nouveau message",viewMessages:"Voir mes messages →",contact:"Nous contacter",yourMessage:"Votre message",service:"Service",subject:"Sujet",subjectPh:"Ex. Question sur ma démarche",message:"Message",messagePh:"Expliquez votre besoin...",destination:"Destinataire",municipal:"Service municipal",sending:"Envoi…",send:"Envoyer mon message →",error:"Impossible d’envoyer votre message."},
  en:{eyebrow:"Citizen relations",title:"Contact us",messages:"My messages",help:"Need help",headline:"Write directly to the city.",intro:<>A question, a difficulty or need for support? Send a message to the right service. You can then track it in <b>My messages</b>.</>,steps:["Choose the relevant service.","Describe what you need simply.","Keep the confirmation reference."],sent:"Message sent",sentText:"Your message was sent to Nova Terra.",newMessage:"New message",viewMessages:"View my messages →",contact:"Contact us",yourMessage:"Your message",service:"Service",subject:"Subject",subjectPh:"E.g. question about my request",message:"Message",messagePh:"Describe what you need...",destination:"Recipient",municipal:"City service",sending:"Sending…",send:"Send my message →",error:"Unable to send your message."},
  mg:{eyebrow:"Fifandraisana amin'ny mponina",title:"Hifandray aminay",messages:"Ny hafatro",help:"Mila fanampiana",headline:"Manorata mivantana amin'ny tanàna.",intro:<>Manana fanontaniana, olana na mila fanampiana? Alefaso any amin'ny sampan-draharaha mety ny hafatrao. Afaka manaraka izany ao amin'ny <b>Ny hafatro</b> ianao.</>,steps:["Safidio ny sampan-draharaha mifandraika.","Hazavao amin'ny fomba tsotra ny filànao.","Tehirizo ny laharana fanamafisana."],sent:"Nalefa ny hafatra",sentText:"Nalefa tany Nova Terra ny hafatrao.",newMessage:"Hafatra vaovao",viewMessages:"Hijery ny hafatro →",contact:"Hifandray aminay",yourMessage:"Ny hafatrao",service:"Sampan-draharaha",subject:"Lohateny",subjectPh:"Ohatra: fanontaniana momba ny fangatahako",message:"Hafatra",messagePh:"Hazavao ny filànao...",destination:"Mpandray",municipal:"Sampan-draharahan'ny tanàna",sending:"Mandefa…",send:"Handefa ny hafatra →",error:"Tsy afaka mandefa ny hafatra."}
};

export default function CitizenHelp(){
  const {user}=useAuth();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);
  const [serviceId,setServiceId]=useState("");
  const [subject,setSubject]=useState("");
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [status,setStatus]=useState(null);

  useEffect(()=>{
    getServices().then(rows=>{setServices(rows);if(rows[0])setServiceId(String(rows[0].id))}).catch(()=>setServices([]));
  },[locale]);

  useEffect(()=>{
    const applyVoiceDictation=(event)=>{
      const text=String(event?.detail?.text||"").trim();
      if(!text)return;
      setMessage(current=>current?`${current} ${text}`:text);
    };
    window.addEventListener("nova-terra-voice-dictation",applyVoiceDictation);
    return()=>window.removeEventListener("nova-terra-voice-dictation",applyVoiceDictation);
  },[]);

  const selected=useMemo(()=>services.find(s=>String(s.id)===String(serviceId)),[services,serviceId]);

  async function submit(event){
    event.preventDefault();setSending(true);setStatus(null);
    try{
      const result=await sendContactMessage({
        name:user?.display_name||`${user?.first_name||""} ${user?.last_name||""}`.trim()||"Citoyen",
        email:user?.email||"",service:serviceId?Number(serviceId):undefined,subject,message,
      });
      const reference=result?.reference||result?.request?.reference||copy.sent;
      setStatus({type:"success",reference,message:copy.sentText});setSubject("");setMessage("");
    }catch(error){setStatus({type:"error",message:getApiErrorMessage(error,copy.error)})}
    finally{setSending(false)}
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={<button className="topbar-ghost" onClick={()=>navigate("/citizen/messages")}>{copy.messages}</button>}/>
      <main className="portal-content">
        <section className="portal-grid portal-grid--2 citizen-contact-layout">
          <article className="portal-card citizen-contact-copy">
            <span className="section-label">{copy.help}</span><h2>{copy.headline}</h2><p>{copy.intro}</p>
            <div className="citizen-contact-points">
              {copy.steps.map((step,index)=><div key={step}><i>{String(index+1).padStart(2,"0")}</i><span>{step}</span></div>)}
            </div>
          </article>

          <article className="portal-card citizen-contact-form-card">
            {status?.type==="success"?<div className="request-studio-success" role="status" aria-live="polite">
              <i aria-hidden="true">✓</i><span className="section-label">{copy.sent}</span><h2>{status.reference}</h2><p>{status.message}</p>
              <div className="request-studio-success__actions"><button className="secondary-action" type="button" onClick={()=>setStatus(null)}>{copy.newMessage}</button><button className="primary-action" type="button" onClick={()=>navigate("/citizen/messages")}>{copy.viewMessages}</button></div>
            </div>:
            <form className="citizen-contact-form" onSubmit={submit}>
              <div><span className="section-label">{copy.contact}</span><h3>{copy.yourMessage}</h3></div>
              <label><span>{copy.service}</span><select value={serviceId} onChange={e=>setServiceId(e.target.value)} required>{services.map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
              <label><span>{copy.subject}</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={copy.subjectPh} required/></label>
              <label><span>{copy.message}</span><textarea rows="6" value={message} onChange={e=>setMessage(e.target.value)} placeholder={copy.messagePh} required/></label>
              <div className="citizen-contact-destination"><span>{copy.destination}</span><b>{selected?.name||copy.municipal}</b></div>
              {status?.type==="error"?<div className="error-card" role="alert">{status.message}</div>:null}
              <button className="primary-action" type="submit" disabled={sending||!serviceId}>{sending?copy.sending:copy.send}</button>
            </form>}
          </article>
        </section>
      </main>
    </div>
  </div>;
}
