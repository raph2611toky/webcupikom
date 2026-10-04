import { useEffect, useMemo, useRef, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import {
  addRequestInformation,
  cancelCitizenReport,
  downloadCitizenReportAttachment,
  getCitizenRequestById,
  reopenCitizenReport,
  updateCitizenReport,
} from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";

const COPY={
  fr:{eyebrow:"Suivi de demande",loading:"Chargement du dossier…",back:"Retour à mes demandes",follow:"Suivi",progress:"Historique du dossier",information:"Informations",details:"Détails",service:"Service",category:"Catégorie",location:"Lieu",notSpecified:"Non précisé",updated:"Dernière mise à jour",attachments:"Pièces jointes",elements:"Éléments transmis",add:"+ Ajouter une information",none:"Aucune pièce jointe pour cette demande.",need:"Besoin d’ajouter une précision ?",needText:"Votre complément sera rattaché au dossier et visible par l’agent.",addInfo:"Ajouter une information",notifications:"Voir mes notifications",complete:"Compléter le dossier",added:"Information ajoutée ✓",addDetail:"Ajouter une précision",modalText:"Votre message et votre photo éventuelle seront rattachés à la timeline du dossier.",message:"Message",messagePh:"Ajoutez une information utile…",save:"Enregistrer →",actionRequired:"Une action est attendue de votre part",cancel:"Annuler le signalement",reopen:"Rouvrir le signalement",edit:"Corriger le signalement",download:"Télécharger",reasonCancel:"Pourquoi annulez-vous ce signalement ?",reasonReopen:"Pourquoi souhaitez-vous rouvrir ce signalement ?",saved:"Signalement mis à jour.",cancelled:"Signalement annulé.",reopened:"Signalement rouvert."},
  en:{eyebrow:"Request tracking",loading:"Loading request…",back:"Back to my requests",follow:"Tracking",progress:"Request history",information:"Information",details:"Details",service:"Service",category:"Category",location:"Location",notSpecified:"Not specified",updated:"Last update",attachments:"Attachments",elements:"Submitted items",add:"+ Add information",none:"No attachment for this request.",need:"Need to add a detail?",needText:"Your complement will be attached to the request and visible to the agent.",addInfo:"Add information",notifications:"View my notifications",complete:"Complete request",added:"Information added ✓",addDetail:"Add a detail",modalText:"Your message and optional photo will be attached to the request timeline.",message:"Message",messagePh:"Add useful information…",save:"Save →",actionRequired:"Action is required from you",cancel:"Cancel report",reopen:"Reopen report",edit:"Edit report",download:"Download",reasonCancel:"Why are you cancelling this report?",reasonReopen:"Why are you reopening this report?",saved:"Report updated.",cancelled:"Report cancelled.",reopened:"Report reopened."},
  mg:{eyebrow:"Fanaraha-maso fangatahana",loading:"Mampiditra ny fangatahana…",back:"Hiverina amin'ny fangatahako",follow:"Fanaraha-maso",progress:"Tantaran'ny fangatahana",information:"Fampahalalana",details:"Antsipiriany",service:"Sampan-draharaha",category:"Sokajy",location:"Toerana",notSpecified:"Tsy voafaritra",updated:"Fanavaozana farany",attachments:"Rakitra",elements:"Zavatra nalefa",add:"+ Hanampy vaovao",none:"Tsy misy rakitra amin'ity fangatahana ity.",need:"Mila manampy fanazavana?",needText:"Hampidirina ao amin'ny fangatahana ny fanazavanao ary ho hitan'ny agent.",addInfo:"Hanampy vaovao",notifications:"Hijery fampahafantarana",complete:"Hameno ny fangatahana",added:"Voampy ny vaovao ✓",addDetail:"Hanampy fanazavana",modalText:"Hampifandraisina amin'ny tantaran'ny fangatahana ny hafatrao sy ny sary raha misy.",message:"Hafatra",messagePh:"Ampio vaovao ilaina…",save:"Hitahiry →",actionRequired:"Misy zavatra andrasana aminao",cancel:"Hanafoana tatitra",reopen:"Hanokatra indray",edit:"Hanitsy tatitra",download:"Hisintona",reasonCancel:"Nahoana no foanana ity tatitra ity?",reasonReopen:"Nahoana no sokafana indray ity tatitra ity?",saved:"Nohavaozina ny tatitra.",cancelled:"Nofoanana ny tatitra.",reopened:"Nosokafana indray ny tatitra."}
};

function displayDate(value,locale){
  if(!value)return "—";
  const date=new Date(value);if(Number.isNaN(date.getTime()))return value;
  const code=locale==="en"?"en-US":locale==="mg"?"mg-MG":"fr-FR";
  return new Intl.DateTimeFormat(code,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date).replace(","," ·");
}

export default function CitizenRequestDetails({params}){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [request,setRequest]=useState(null);
  const [showNote,setShowNote]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [note,setNote]=useState("");
  const [noteFile,setNoteFile]=useState(null);
  const [edit,setEdit]=useState({title:"",description:"",location_text:"",district:"",severity:"moderate"});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const fileRef=useRef(null);

  async function load(){
    setError("");
    try{
      const row=await getCitizenRequestById(params.id);
      setRequest(row);
      setEdit({title:row.title||"",description:row.description||"",location_text:row.location?.label||"",district:row.district||"",severity:row.severityCode||"moderate"});
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger ce dossier."))}
  }
  useEffect(()=>{load()},[params.id]);

  const timeline=useMemo(()=>request?.timeline?.length?request.timeline:request?.history||[],[request]);
  const isReport=request?.requestType==="signalement";
  const canEdit=isReport&&!request?.isClosed&&(request?.availableActions?.includes("edit")||["submitted","pending"].includes(request?.statusCode));
  const canCancel=isReport&&!request?.isClosed&&(request?.availableActions?.includes("cancel")||["submitted","pending","in_progress","action_required"].includes(request?.statusCode));
  const canMessage=request?.availableActions?.includes("add_message")||isReport||request?.statusCode==="action_required";

  async function saveNote(event){
    event.preventDefault(); if(!note.trim()&&!noteFile)return;
    setBusy(true);setError("");
    try{
      const result=await addRequestInformation(request.ref,note.trim(),noteFile?[noteFile]:[]);
      setNote("");setNoteFile(null);
      setNotice(result?.channel==="contact"
        ? `Message transmis à la mairie${result?.contact?.reference?` · ${result.contact.reference}`:""}. Le backend n’a pas rattaché ce complément directement à la timeline.`
        : copy.added);
      setShowNote(false);await load();
    }catch(e){setError(getApiErrorMessage(e,"Impossible d’ajouter cette information."))}finally{setBusy(false)}
  }

  async function cancelReport(){
    const reason=window.prompt(copy.reasonCancel);if(!reason?.trim())return;
    setBusy(true);setError("");try{await cancelCitizenReport(request.ref,reason.trim());setNotice(copy.cancelled);await load()}catch(e){setError(getApiErrorMessage(e,"Annulation impossible."))}finally{setBusy(false)}
  }
  async function reopenReport(){
    const reason=window.prompt(copy.reasonReopen);if(!reason?.trim())return;
    setBusy(true);setError("");try{await reopenCitizenReport(request.ref,reason.trim());setNotice(copy.reopened);await load()}catch(e){setError(getApiErrorMessage(e,"Réouverture impossible."))}finally{setBusy(false)}
  }
  async function saveEdit(event){
    event.preventDefault();setBusy(true);setError("");
    try{await updateCitizenReport(request.ref,edit);setNotice(copy.saved);setShowEdit(false);await load()}catch(e){setError(getApiErrorMessage(e,"Modification impossible."))}finally{setBusy(false)}
  }
  async function download(file){
    setError("");try{await downloadCitizenReportAttachment(file)}catch(e){setError(getApiErrorMessage(e,"Téléchargement impossible."))}
  }
  async function printRequest(){
    setError("");
    try{const {buildSingleRequestHtml,openPrintWindow}=await import("../../utils/dataExport.js");openPrintWindow(buildSingleRequestHtml(request))}catch(e){setError(e?.message||"Export impossible.")}
  }
  async function exportRequestJson(){
    const reference=request.reference||request.ref||"demande";
    const {downloadJson}=await import("../../utils/dataExport.js");
    downloadJson(`nova-terra-${String(reference).toLowerCase()}.json`,request);
  }

  if(!request)return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={copy.eyebrow} title={params.id}/><main className="portal-content">{error?<div className="error-card" role="alert">{error}</div>:<section className="portal-card">{copy.loading}</section>}</main></div></div>;

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={request.ref}/>
    <main className="portal-content citizen-request-detail-v51 citizen-request-detail-page">
      <button className="back-link" onClick={()=>navigate(isReport?"/citizen/signalements":"/citizen/requests")}>← {isReport?(locale==="en"?"Back to my reports":locale==="mg"?"Hiverina amin'ny tatitra":"Retour à mes signalements"):copy.back}</button>
      {error?<div className="error-card" role="alert">{error}</div>:null}{notice?<div className="success-inline" role="status">✓ {notice}</div>:null}

      <section className="request-detail-hero request-detail-hero--soft">
        <div className="request-detail-hero__icon" aria-hidden="true">💧</div>
        <div className="request-detail-hero__content">
          <span>{request.category||request.service}</span>
          <h2>{request.title}</h2>
          <div className="request-detail-hero__meta">
            <small>📍 {request.location?.label || request.district || copy.notSpecified}</small>
            <small>🗓 {request.updated}</small>
          </div>
          <p>{request.description}</p>
        </div>
        <em className={`status-pill status-${String(request.status).replaceAll(" ","-").toLowerCase()}`}>{request.status}</em>
      </section>

      {request.statusCode==="action_required"?<section className="portal-card action-required-card" role="status"><span className="section-label">{copy.actionRequired}</span><h3>{request.resolutionSummary||"Merci de compléter votre dossier."}</h3><button className="primary-action" type="button" onClick={()=>setShowNote(true)}>{copy.addInfo}</button></section>:null}

      <section className="portal-grid portal-grid--detail request-detail-grid">
        <article className="portal-card request-history-card">
          <span className="section-label">{copy.follow}</span><h3>{copy.progress}</h3>
          <div className="activity-feed citizen-request-timeline">{timeline.map((item,index)=><div key={item.key||index}><i>{item.eventType==="status"?"●":item.eventType==="created"?"✓":"◆"}</i><div><b>{item.title||item.label}</b>{item.message?<small>{item.message}</small>:null}<span>{item.actorName?`${item.actorName}${item.actorRole?` (${item.actorRole})`:""} · `:""}{displayDate(item.createdAt||item.at,locale)}</span>{item.attachments?.length?<small>{item.attachments.length} pièce(s) jointe(s)</small>:null}</div></div>)}{!timeline.length?<div className="empty-inline">Aucun événement de suivi.</div>:null}</div>
        </article>

        <article className="portal-card request-details-card">
          <span className="section-label">{copy.information}</span><h3>{copy.details}</h3>
          <div className="detail-list">
            {isReport?<><div><span>{locale==="en"?"Report type":locale==="mg"?"Karazana tatitra":"Type de signalement"}</span><b>{request.reportType||request.category||"Signalement"}</b></div><div><span>Gravité</span><b>{request.severity||"—"}</b></div></>:null}
            <div><span>{copy.service}</span><b>{request.service}</b></div><div><span>{copy.category}</span><b>{request.category||"—"}</b></div><div><span>{copy.location}</span><b>{request.location?.label||request.district||copy.notSpecified}</b></div><div><span>{copy.updated}</span><b>{request.updated}</b></div>{request.resolutionSummary?<div><span>Décision / suivi</span><b>{request.resolutionSummary}</b></div>:null}{request.cancellationReason?<div><span>Motif d’annulation</span><b>{request.cancellationReason}</b></div>:null}
          </div>
          {request.location?.latitude!=null?<div className="request-location-chip">⌖ {request.location.latitude}, {request.location.longitude}{request.location.accuracy!=null?` · ±${request.location.accuracy} m`:""}</div>:null}
        </article>

        <article className="portal-card portal-card--wide request-attachments-card request-soft-panel">
          <div className="portal-card__head"><div><span className="section-label">{copy.attachments}</span><h3>{copy.elements}</h3></div>{canMessage?<button type="button" onClick={()=>setShowNote(true)}>{copy.add}</button>:null}</div>
          {request.attachments?.length?<div className="document-grid">{request.attachments.map((file,index)=><div className="document-row" key={file.id||index}><i>{file.type?.includes("image")?"IMG":"DOC"}</i><div><b>{file.name}</b><span>{file.caption||file.uploaderName||"Pièce jointe"}{file.size?` · ${Math.max(1,Math.round(file.size/1024))} Ko`:""}</span></div>{file.downloadUrl?<button type="button" onClick={()=>download(file)}>{copy.download}</button>:null}</div>)}</div>:<div className="empty-inline">{copy.none}</div>}
        </article>

        <article className="portal-card portal-card--wide request-single-export request-soft-panel" aria-labelledby="single-request-export-title">
          <div>
            <span className="section-label">Export du dossier</span>
            <h3 id="single-request-export-title">Exporter cette demande</h3>
            <p className="detail-copy">Conservez une copie lisible de ce dossier avec sa référence, son statut, les informations principales et son historique.</p>
          </div>
          <div className="request-single-export__actions">
            <button className="primary-action" type="button" onClick={printRequest}>Imprimer / PDF</button>
            <button className="secondary-action" type="button" onClick={exportRequestJson}>JSON</button>
          </div>
        </article>

        <article className="action-bar portal-card--wide">
          <div><b>{copy.need}</b><span>{copy.needText}</span></div>
          <div>{canMessage?<button className="secondary-action" onClick={()=>setShowNote(true)}>{copy.addInfo}</button>:null}{canEdit?<button className="secondary-action" onClick={()=>setShowEdit(true)}>{copy.edit}</button>:null}{canCancel?<button className="text-danger" disabled={busy} onClick={cancelReport}>{copy.cancel}</button>:null}{isReport&&request.isClosed?<button className="secondary-action" disabled={busy} onClick={reopenReport}>{copy.reopen}</button>:null}<button className="primary-action" onClick={()=>navigate("/citizen/notifications")}>{copy.notifications}</button></div>
        </article>
      </section>

      {showNote?<div className="modal-backdrop" onClick={()=>setShowNote(false)}><form className="portal-modal compact-note-modal" onClick={e=>e.stopPropagation()} onSubmit={saveNote}><button type="button" className="modal-close" onClick={()=>setShowNote(false)}>×</button><span className="section-label">{copy.complete}</span><h2>{copy.addDetail}</h2><p>{copy.modalText}</p><label><span>{copy.message}</span><textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} placeholder={copy.messagePh}/></label><label><span>Photo (optionnelle)</span><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setNoteFile(e.target.files?.[0]||null)}/></label><button className="primary-action" type="submit" disabled={busy||(!note.trim()&&!noteFile)}>{busy?"Envoi…":copy.save}</button></form></div>:null}

      {showEdit&&isReport?<div className="modal-backdrop" onClick={()=>setShowEdit(false)}><form className="portal-modal compact-note-modal" onClick={e=>e.stopPropagation()} onSubmit={saveEdit}><button type="button" className="modal-close" onClick={()=>setShowEdit(false)}>×</button><span className="section-label">Correction avant traitement</span><h2>{copy.edit}</h2><label><span>Titre</span><input value={edit.title} onChange={e=>setEdit(v=>({...v,title:e.target.value}))}/></label><label><span>Description</span><textarea rows="4" value={edit.description} onChange={e=>setEdit(v=>({...v,description:e.target.value}))}/></label><label><span>Lieu</span><input value={edit.location_text} onChange={e=>setEdit(v=>({...v,location_text:e.target.value}))}/></label><label><span>Quartier</span><input value={edit.district} onChange={e=>setEdit(v=>({...v,district:e.target.value}))}/></label><label><span>Gravité</span><select value={edit.severity} onChange={e=>setEdit(v=>({...v,severity:e.target.value}))}><option value="minor">Mineure</option><option value="moderate">Modérée</option><option value="major">Majeure</option><option value="critical">Critique</option></select></label><button className="primary-action" type="submit" disabled={busy}>{busy?"Enregistrement…":"Enregistrer"}</button></form></div>:null}
    </main>
  </div></div>;
}
