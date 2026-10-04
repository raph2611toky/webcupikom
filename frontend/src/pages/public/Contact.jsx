import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { createCitizenRequest } from "../../api/requests.js";
import { sendContactMessage } from "../../api/contact.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { CATEGORY_SERVICE, REQUEST_CATEGORIES, REQUEST_TYPES } from "../../constants/requestOptions.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const initialForm={type:"question",category:"Administration",name:"",email:"",subject:"",message:"",location:""};

const COPY={
  fr:{kicker:"Aide & contact",title:<>Comment pouvons-nous <em>vous aider ?</em></>,intro:"Choisissez votre besoin, décrivez-le simplement et envoyez votre message au bon service municipal.",sent:"Message transmis",sentText:"Votre message a bien été reçu par Nova Terra et orienté vers",status:"Statut",service:"Service",track:"Suivre ma demande →",newMessage:"Nouveau message",name:"Nom",namePh:"Votre nom",email:"E-mail",category:"Catégorie",subject:"Sujet",subjectPh:"Ex. Question sur un service",message:"Message",messagePh:"Expliquez simplement votre besoin...",hide:"− Masquer la localisation",show:"+ Ajouter une localisation",location:"Localisation",optional:"optionnel",locationPh:"Secteur, rue, bâtiment...",destination:"Service destinataire",loading:"Chargement...",sending:"Transmission...",send:"Envoyer mon message →",error:"Impossible d’envoyer votre message."},
  en:{kicker:"Help & contact",title:<>How can we <em>help you?</em></>,intro:"Choose what you need, describe it simply and send your message to the right city service.",sent:"Message sent",sentText:"Your message was received by Nova Terra and routed to",status:"Status",service:"Service",track:"Track my request →",newMessage:"New message",name:"Name",namePh:"Your name",email:"Email",category:"Category",subject:"Subject",subjectPh:"E.g. question about a service",message:"Message",messagePh:"Describe what you need...",hide:"− Hide location",show:"+ Add a location",location:"Location",optional:"optional",locationPh:"Area, street, building...",destination:"Destination service",loading:"Loading...",sending:"Sending...",send:"Send my message →",error:"Unable to send your message."},
  mg:{kicker:"Fanampiana & fifandraisana",title:<>Ahoana no ahafahanay <em>manampy anao?</em></>,intro:"Safidio ny filànao, hazavao amin'ny fomba tsotra ary alefaso any amin'ny sampan-draharaha mety ny hafatrao.",sent:"Nalefa ny hafatra",sentText:"Voarain'i Nova Terra ny hafatrao ary nalefa any amin'ny",status:"Sata",service:"Sampan-draharaha",track:"Hanaraka ny fangatahako →",newMessage:"Hafatra vaovao",name:"Anarana",namePh:"Ny anaranao",email:"Mailaka",category:"Sokajy",subject:"Lohateny",subjectPh:"Ohatra: fanontaniana momba ny sampan-draharaha",message:"Hafatra",messagePh:"Hazavao amin'ny fomba tsotra ny filànao...",hide:"− Afeno ny toerana",show:"+ Ampio toerana",location:"Toerana",optional:"tsy voatery",locationPh:"Faritra, arabe, trano...",destination:"Sampan-draharaha handray",loading:"Mampiditra...",sending:"Mandefa...",send:"Handefa ny hafatra →",error:"Tsy afaka mandefa ny hafatra."}
};

const TYPE_LABELS={
  en:{question:"Question",signalement:"Report a problem",demarche:"Procedure",suggestion:"Suggestion",assistance:"Assistance"},
  mg:{question:"Fanontaniana",signalement:"Hitatitra olana",demarche:"Dingana",suggestion:"Soso-kevitra",assistance:"Fanampiana"}
};
const CATEGORY_LABELS={
  en:{"État civil":"Civil registry","Voirie":"Roads","Eau / assainissement":"Water / sanitation","Éclairage public":"Street lighting","Transport":"Transport","Déchets":"Waste","Services numériques":"Digital services","Autre":"Other","Administration":"Administration"},
  mg:{"État civil":"Soram-panjakana","Voirie":"Lalana","Eau / assainissement":"Rano / fanadiovana","Éclairage public":"Jiro an-dalambe","Transport":"Fitaterana","Déchets":"Fako","Services numériques":"Sampan-draharaha nomerika","Autre":"Hafa","Administration":"Fitantanana"}
};

function findService(services,category){
  const target=String(CATEGORY_SERVICE[category]||category||"").toLowerCase();
  return services.find(service=>{
    const values=[service.name,service.category,service.slug].filter(Boolean).map(v=>String(v).toLowerCase());
    return values.some(v=>v===target||v.includes(target)||target.includes(v));
  })||services.find(service=>String(service.slug||"").toLowerCase()==="administration")||services[0]||null;
}

export default function Contact(){
  const {user,isAuthenticated}=useAuth();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const isCitizen=isAuthenticated&&user?.role==="citizen";
  const displayName=user?.display_name||`${user?.first_name||""} ${user?.last_name||""}`.trim();

  const [services,setServices]=useState([]);
  const [form,setForm]=useState(()=>({...initialForm,name:isCitizen?displayName:"",email:isCitizen?user?.email||"":""}));
  const [showExtras,setShowExtras]=useState(false);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(null);
  const [error,setError]=useState("");

  useEffect(()=>{getServices().then(setServices).catch(()=>setServices([]))},[locale]);
  useEffect(()=>{if(isCitizen)setForm(current=>({...current,name:displayName,email:user?.email||""}))},[isCitizen,displayName,user?.email]);

  const service=useMemo(()=>findService(services,form.category),[services,form.category]);
  function patch(key,value){setForm(current=>({...current,[key]:value}))}

  async function submit(event){
    event.preventDefault();
    if(!service)return;
    setSending(true);setError("");
    try{
      if(isCitizen){
        const request=await createCitizenRequest({type:form.type,category:form.category,service:service.id,subject:form.subject,message:form.message,location:form.location?{label:form.location}:null});
        setSent({reference:request.reference,service:request.service,status:request.status,kind:"request"});
      }else{
        const response=await sendContactMessage({name:form.name.trim(),email:form.email.trim(),service:Number(service.id),subject:form.subject.trim(),message:`${form.message.trim()}${form.location?`\n\nLocalisation : ${form.location}`:""}\n\nType : ${form.type} · Catégorie : ${form.category}`});
        setSent({reference:response?.reference||response?.request?.reference||copy.sent,service:service.name,status:locale==="en"?"Received":locale==="mg"?"Voaray":"Reçu",kind:"contact"});
      }
    }catch(err){setError(getApiErrorMessage(err,copy.error))}
    finally{setSending(false)}
  }

  function reset(){setSent(null);setError("");setShowExtras(false);setForm({...initialForm,name:isCitizen?displayName:"",email:isCitizen?user?.email||"":""})}

  return <div className="public-page public-page--contact public-page--smart-request">
    <PublicHeader/>
    <main>
      <section className="public-hero public-hero--compact smart-request-hero smart-request-hero--simple">
        <span className="public-kicker">{copy.kicker}</span><h1>{copy.title}</h1><p>{copy.intro}</p>
      </section>

      <section className="public-content smart-request-layout smart-request-layout--single">
        <div className="contact-form-panel smart-request-panel smart-request-panel--single">
          {sent?<div className="smart-request-success" role="status" aria-live="polite">
            <div className="smart-request-success__check">✓</div>
            <div><span className="section-label">{copy.sent}</span><h2>{sent.reference}</h2><p>{copy.sentText} <b>{sent.service}</b>.</p></div>
            <div className="smart-request-success__status"><span>{copy.status}</span><b>{sent.status}</b><span>{copy.service}</span><b>{sent.service}</b></div>
            <div className="smart-request-success__actions">
              {sent.kind==="request"?<button className="primary-button" onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(sent.reference)}`)}>{copy.track}</button>:null}
              <button className="secondary-button" onClick={reset}>{copy.newMessage}</button>
            </div>
          </div>:
          <form onSubmit={submit} className="public-form smart-request-form smart-request-form--simple">
            <div className="smart-request-types" aria-label="Type de demande">
              {REQUEST_TYPES.map(item=><button type="button" className={form.type===item.value?"is-active":""} aria-pressed={form.type===item.value} key={item.value} onClick={()=>patch("type",item.value)}><i aria-hidden="true">{item.icon}</i><span>{TYPE_LABELS[locale]?.[item.value]||item.label}</span></button>)}
            </div>

            <div className="smart-request-grid">
              {!isCitizen?<><label><span>{copy.name}</span><input required value={form.name} onChange={e=>patch("name",e.target.value)} placeholder={copy.namePh}/></label><label><span>{copy.email}</span><input required type="email" value={form.email} onChange={e=>patch("email",e.target.value)} placeholder="vous@exemple.com"/></label></>:null}
              <label className="span-2"><span>{copy.category}</span><select value={form.category} onChange={e=>patch("category",e.target.value)}>{REQUEST_CATEGORIES.map(category=><option key={category} value={category}>{CATEGORY_LABELS[locale]?.[category]||category}</option>)}</select></label>
              <label className="span-2"><span>{copy.subject}</span><input required value={form.subject} onChange={e=>patch("subject",e.target.value)} placeholder={copy.subjectPh}/></label>
              <label className="span-2"><span>{copy.message}</span><textarea required rows="4" value={form.message} onChange={e=>patch("message",e.target.value)} placeholder={copy.messagePh}/></label>
            </div>

            <button className="smart-request-extra-toggle" type="button" onClick={()=>setShowExtras(v=>!v)}>{showExtras?copy.hide:copy.show}</button>
            {showExtras?<div className="smart-request-evidence smart-request-evidence--simple"><label><span>{copy.location} <em>{copy.optional}</em></span><input value={form.location} onChange={e=>patch("location",e.target.value)} placeholder={copy.locationPh}/></label></div>:null}

            <div className="smart-request-submit-row"><div><span>{copy.destination}</span><b>{service?.name||copy.loading}</b></div><button className="primary-button" type="submit" disabled={sending||!service}>{sending?copy.sending:copy.send}</button></div>
            {error?<div className="error-card" role="alert">{error}</div>:null}
          </form>}
        </div>
      </section>
    </main>
    <Footer/>
  </div>;
}
