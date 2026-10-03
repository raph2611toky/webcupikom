import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { addRequestInformation, getCitizenRequestById } from "../../api/requests.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Suivi de demande",loading:"Chargement du dossier…",back:"Retour à mes demandes",follow:"Suivi",progress:"Avancement de la demande",next:"Étape suivante",information:"Informations",details:"Détails du signalement",service:"Service",category:"Catégorie",location:"Lieu",notSpecified:"Non précisé",updated:"Dernière mise à jour",attachments:"Pièces jointes",elements:"Éléments transmis",add:"+ Ajouter une information",attached:"joint à la demande",view:"Voir",none:"Aucune pièce jointe pour cette demande.",need:"Besoin d’ajouter une précision ?",needText:"Complétez le dossier ici sans quitter votre espace citoyen.",addInfo:"Ajouter une information",notifications:"Voir mes notifications",complete:"Compléter le dossier",added:"Information ajoutée ✓",addDetail:"Ajouter une précision",modalText:"Votre message sera rattaché à la demande et visible par l’agent chargé du dossier.",message:"Message",messagePh:"Ajoutez une information utile...",save:"Enregistrer →"},
  en:{eyebrow:"Request tracking",loading:"Loading request…",back:"Back to my requests",follow:"Tracking",progress:"Request progress",next:"Next step",information:"Information",details:"Report details",service:"Service",category:"Category",location:"Location",notSpecified:"Not specified",updated:"Last update",attachments:"Attachments",elements:"Submitted items",add:"+ Add information",attached:"attached to the request",view:"View",none:"No attachment for this request.",need:"Need to add a detail?",needText:"Complete the request here without leaving your citizen space.",addInfo:"Add information",notifications:"View my notifications",complete:"Complete the request",added:"Information added ✓",addDetail:"Add a detail",modalText:"Your message will be linked to the request and visible to the agent handling it.",message:"Message",messagePh:"Add useful information...",save:"Save →"},
  mg:{eyebrow:"Fanaraha-maso fangatahana",loading:"Mampiditra ny fangatahana…",back:"Hiverina amin'ny fangatahako",follow:"Fanaraha-maso",progress:"Fandrosoan'ny fangatahana",next:"Dingana manaraka",information:"Fampahalalana",details:"Antsipirian'ny tatitra",service:"Sampan-draharaha",category:"Sokajy",location:"Toerana",notSpecified:"Tsy voafaritra",updated:"Fanavaozana farany",attachments:"Rakitra",elements:"Zavatra nalefa",add:"+ Hanampy vaovao",attached:"miaraka amin'ny fangatahana",view:"Hijery",none:"Tsy misy rakitra amin'ity fangatahana ity.",need:"Mila manampy fanazavana?",needText:"Fenoy eto ny fangatahana nefa tsy miala amin'ny habakao.",addInfo:"Hanampy vaovao",notifications:"Hijery fampahafantarana",complete:"Hameno ny fangatahana",added:"Voampy ny vaovao ✓",addDetail:"Hanampy fanazavana",modalText:"Hampifandraisina amin'ny fangatahana ny hafatrao ary ho hitan'ny mpiasa mikarakara azy.",message:"Hafatra",messagePh:"Ampio vaovao ilaina...",save:"Hitahiry →"}
};

const STATUS={
  en:{"Envoyée":"Sent","En attente":"Pending","En traitement":"In progress","Action requise":"Action required","Terminée":"Completed"},
  mg:{"Envoyée":"Nalefa","En attente":"Miandry","En traitement":"Eo am-pikarakarana","Action requise":"Mila hetsika","Terminée":"Vita"}
};

const HISTORY={
  en:{"Demande envoyée":"Request sent","Demande reçue par la ville":"Received by the city","Prise en charge par un agent":"Taken in charge by an agent","Traitement en cours":"In progress","Résolue":"Resolved"},
  mg:{"Demande envoyée":"Nalefa ny fangatahana","Demande reçue par la ville":"Voarain'ny tanàna","Prise en charge par un agent":"Noraisin'ny mpiasa","Traitement en cours":"Eo am-pikarakarana","Résolue":"Voavaha"}
};

const fallbackTimeline=[
  {label:"Demande envoyée",state:"done"},
  {label:"Demande reçue par la ville",state:"done"},
  {label:"Prise en charge par un agent",state:"next"},
  {label:"Traitement en cours",state:"next"},
  {label:"Résolue",state:"next"},
];

function displayDate(value,locale){
  if(!value)return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return value;
  const code=locale==="en"?"en-US":locale==="mg"?"mg-MG":"fr-FR";
  return new Intl.DateTimeFormat(code,{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(date).replace(","," ·");
}

export default function CitizenRequestDetails({params}){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [request,setRequest]=useState(null);
  const [showNote,setShowNote]=useState(false);
  const [note,setNote]=useState("");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{getCitizenRequestById(params.id).then(setRequest)},[params.id]);

  const timeline=useMemo(()=>{
    const history=request?.history?.length?request.history:fallbackTimeline;
    const done=history.filter(item=>item.state==="done");
    const next=history.filter(item=>item.state!=="done");
    const currentIndex=Math.max(0,done.length-1);
    return [...done,...next].map((item,index)=>({
      ...item,
      label:HISTORY[locale]?.[item.label]||item.label,
      at:item.at?displayDate(item.at,locale):copy.next,
      state:item.state==="done"&&index===currentIndex?"current":item.state,
    }));
  },[request,locale]);

  if(!request)return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={copy.eyebrow} title={params.id}/><main className="portal-content"><section className="portal-card">{copy.loading}</section></main></div></div>;

  async function saveNote(event){
    event.preventDefault();
    if(!note.trim())return;
    await addRequestInformation(request.id,note.trim());
    setSaved(true);setNote("");
    window.setTimeout(()=>{setShowNote(false);setSaved(false)},650);
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={request.id}/>
      <main className="portal-content">
        <button className="back-link" onClick={()=>navigate("/citizen/requests")}>← {copy.back}</button>
        <section className="request-detail-hero">
          <div><span>{request.category||request.service}</span><h2>{request.title}</h2><p>{request.description}</p></div>
          <em className={`status-pill status-${String(request.status).replaceAll(" ","-").toLowerCase()}`}>{STATUS[locale]?.[request.status]||request.status}</em>
        </section>

        <section className="portal-grid portal-grid--detail">
          <article className="portal-card">
            <span className="section-label">{copy.follow}</span><h3>{copy.progress}</h3>
            <div className="timeline">{timeline.slice(0,5).map((item,index)=><div key={`${item.label}-${index}`} className={item.state==="done"?"done":item.state==="current"?"current":""}><i aria-hidden="true">{item.state==="done"?"✓":item.state==="current"?"●":"○"}</i><div><b>{item.label}</b><span>{item.at}</span></div></div>)}</div>
          </article>

          <article className="portal-card">
            <span className="section-label">{copy.information}</span><h3>{copy.details}</h3>
            <div className="detail-list">
              <div><span>{copy.service}</span><b>{request.service}</b></div>
              <div><span>{copy.category}</span><b>{request.category||"—"}</b></div>
              <div><span>{copy.location}</span><b>{request.location?.label||request.district||copy.notSpecified}</b></div>
              <div><span>{copy.updated}</span><b>{request.updated}</b></div>
            </div>
            {request.location?.latitude?<div className="request-location-chip">⌖ {request.location.latitude}, {request.location.longitude}</div>:null}
          </article>

          <article className="portal-card portal-card--wide request-attachments-card">
            <div className="portal-card__head"><div><span className="section-label">{copy.attachments}</span><h3>{copy.elements}</h3></div><button onClick={()=>setShowNote(true)}>{copy.add}</button></div>
            {request.attachments?.length?<div className="document-grid">{request.attachments.map(file=><div className="document-row" key={file.name}><i>{file.type?.includes("image")?"IMG":"PDF"}</i><div><b>{file.name}</b><span>{Math.max(1,Math.round((file.size||0)/1024))} Ko · {copy.attached}</span></div><button>{copy.view}</button></div>)}</div>:<div className="empty-inline">{copy.none}</div>}
          </article>

          <article className="action-bar portal-card--wide">
            <div><b>{copy.need}</b><span>{copy.needText}</span></div>
            <div><button className="secondary-action" onClick={()=>setShowNote(true)}>{copy.addInfo}</button><button className="primary-action" onClick={()=>navigate("/citizen/notifications")}>{copy.notifications}</button></div>
          </article>
        </section>

        {showNote?<div className="modal-backdrop" onClick={()=>setShowNote(false)}><form className="portal-modal compact-note-modal" onClick={event=>event.stopPropagation()} onSubmit={saveNote}><button type="button" className="modal-close" onClick={()=>setShowNote(false)}>×</button><span className="section-label">{copy.complete}</span><h2>{saved?copy.added:copy.addDetail}</h2><p>{copy.modalText}</p><label><span>{copy.message}</span><textarea rows="4" value={note} onChange={event=>setNote(event.target.value)} placeholder={copy.messagePh}/></label><button className="primary-action" type="submit">{copy.save}</button></form></div>:null}
      </main>
    </div>
  </div>;
}
