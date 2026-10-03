import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { addAgentReportAttachments, addAgentRequestTimeline, getAgentRequestById, reopenAgentReport, updateAgentRequest } from "../../api/requests.js";
import { getAssignees } from "../../api/citizens.js";
import { getServices } from "../../api/services.js";
import { sendAgentNotification } from "../../api/notifications.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const STATUS_OPTIONS=[
  ["submitted","Envoyée"],["pending","À traiter"],["in_progress","En traitement"],["action_required","Action requise"],["completed","Terminée"],["rejected","Rejetée"],["cancelled","Annulée"],
];
const PRIORITY_OPTIONS=[["low","Basse"],["normal","Normale"],["high","Haute"],["urgent","Urgente"]];

function displayDate(value){
  if(!value)return "—";const date=new Date(value);if(Number.isNaN(date.getTime()))return value;
  return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date).replace(","," ·");
}

export default function AgentRequestDetails({params}){
  const {user}=useAuth();
  const [request,setRequest]=useState(null);
  const [assignees,setAssignees]=useState([]);
  const [services,setServices]=useState([]);
  const [form,setForm]=useState({status:"pending",priority:"normal",assigned_to:"",service:"",resolution_summary:""});
  const [note,setNote]=useState({title:"Mise à jour du dossier",message:"",is_public:true});
  const [reportFiles,setReportFiles]=useState([]);
  const [reportPublic,setReportPublic]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    const [row,people,serviceRows]=await Promise.all([getAgentRequestById(params.id),getAssignees(),getServices()]);
    setRequest(row);setAssignees(people);setServices(serviceRows);
    setForm({status:row.statusCode||"pending",priority:row.priorityCode||"normal",assigned_to:row.assignedTo??"",service:row.serviceId??"",resolution_summary:row.resolutionSummary||""});
  }
  useEffect(()=>{load().catch(e=>setError(getApiErrorMessage(e,"Impossible de charger le dossier.")))},[params.id]);

  const history=useMemo(()=>request?.timeline?.length?request.timeline:request?.history||[],[request]);
  const sensitiveStatus=["completed","rejected","action_required"].includes(form.status);

  async function notifyCitizen(updated, title, message){
    if(!updated?.citizenId)return;
    try{await sendAgentNotification({recipient:Number(updated.citizenId),title,message,action_label:"Voir ma demande",action_url:`/citizen/requests/${encodeURIComponent(updated.ref)}`,is_important:form.status==="action_required"})}catch{/* la mise à jour principale reste valide */}
  }

  async function saveChanges(overrides={}){
    if(!request||saving)return;
    const next={...form,...overrides};
    if(["completed","rejected","action_required"].includes(next.status)&&!String(next.resolution_summary||"").trim()){
      setError("Ajoutez un résumé : il est obligatoire pour terminer, rejeter ou demander une action au citoyen.");return;
    }
    setSaving(true);setError("");setNotice("");
    try{
      const payload={status:next.status,priority:next.priority,assigned_to:next.assigned_to,service:next.service,resolution_summary:next.resolution_summary};
      const updated=await updateAgentRequest(request.ref,payload);
      await notifyCitizen(updated,"Mise à jour de votre demande",`La demande ${updated.ref} est maintenant : ${updated.status}. ${next.resolution_summary||""}`.trim());
      setNotice("Dossier mis à jour et action enregistrée dans le journal d’audit.");
      await load();
    }catch(e){setError(getApiErrorMessage(e,"Impossible de mettre à jour le dossier."))}
    finally{setSaving(false)}
  }

  async function takeOwnership(){
    const myId=user?.id||assignees.find(a=>a.email===user?.email)?.id;
    setForm(v=>({...v,status:"in_progress",assigned_to:myId||v.assigned_to}));
    await saveChanges({status:"in_progress",assigned_to:myId||form.assigned_to});
  }

  async function addTimeline(){
    if(!note.title.trim()||(!note.message.trim())){setError("Ajoutez un message à l’étape de suivi.");return}
    setSaving(true);setError("");
    try{await addAgentRequestTimeline(request.ref,note);setNote({title:"Mise à jour du dossier",message:"",is_public:true});setNotice(note.is_public?"Étape publique ajoutée au suivi citoyen.":"Note interne ajoutée.");await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible d’ajouter l’étape."))}
    finally{setSaving(false)}
  }


  async function uploadReportFiles(){
    if(!reportFiles.length)return;setSaving(true);setError("");
    try{await addAgentReportAttachments(request.ref,reportFiles,{isPublic:reportPublic});setReportFiles([]);setNotice("Photo(s) ajoutée(s) au signalement.");await load()}
    catch(e){setError(getApiErrorMessage(e,"Impossible d’ajouter les photos."))}finally{setSaving(false)}
  }
  async function reopenReport(){
    const reason=window.prompt("Motif de réouverture du signalement");if(!reason?.trim())return;setSaving(true);setError("");
    try{await reopenAgentReport(request.ref,reason.trim());setNotice("Signalement rouvert.");await load()}catch(e){setError(getApiErrorMessage(e,"Réouverture impossible."))}finally{setSaving(false)}
  }

  if(!request)return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Dossier citoyen" title={`Demande ${params.id}`}/><main className="portal-content">{error?<div className="error-card">{error}</div>:<div className="loading-card">Chargement du dossier…</div>}</main></div></div>;

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Dossier citoyen" title={`Demande ${request.ref}`} actions={<button className="secondary-action" onClick={()=>navigate(`/agent/audit?resource_type=request&resource_id=${encodeURIComponent(request.id)}`)}>Voir l’audit</button>}/>
    <main className="portal-content agent-request-detail-v50">
      <button className="back-link" onClick={()=>navigate(request.requestType==="signalement"?"/agent/signalements":"/agent/requests")}>← Retour</button>
      {error?<div className="error-card" role="alert">{error}</div>:null}{notice?<div className="success-inline" role="status">✓ {notice}</div>:null}

      <section className="agent-detail-head agent-detail-head--smart">
        <div><span>{request.workflowLabel||request.category||request.service}</span><h2>{request.title}</h2><p>{request.citizen} · {request.citizenEmail||"sans e-mail"} · créée {request.created}</p><div className="workflow-flags">{request.requiresAgentAction?<em>Action agent requise</em>:null}{request.requiresCitizenAction?<em>Attente du citoyen</em>:null}{request.needsTriage?<em>À router</em>:null}</div></div>
        <div className="agent-detail-controls agent-detail-controls--v50">
          <label><span>Statut</span><select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value}))}>{STATUS_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label><span>Priorité</span><select value={form.priority} onChange={e=>setForm(v=>({...v,priority:e.target.value}))}>{PRIORITY_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label><span>Responsable</span><select value={form.assigned_to??""} onChange={e=>setForm(v=>({...v,assigned_to:e.target.value?Number(e.target.value):""}))}><option value="">Non assigné</option>{assignees.map(a=><option key={a.id} value={a.id}>{a.display_name} · {a.role}</option>)}</select></label>
          <label><span>Service</span><select value={form.service??""} onChange={e=>setForm(v=>({...v,service:e.target.value?Number(e.target.value):""}))}><option value="">À trier</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>
      </section>

      <section className="portal-grid portal-grid--detail agent-smart-grid">
        <article className="portal-card"><span className="section-label">Besoin exprimé</span><h3>{request.requestType==="signalement"?"Signalement citoyen":"Demande citoyenne"}</h3><p className="detail-copy">{request.description||"Aucune description."}</p><div className="detail-list compact-detail-list"><div><span>Type</span><b>{request.requestTypeCode||request.requestType}</b></div><div><span>Catégorie</span><b>{request.category||request.reportType||"—"}</b></div><div><span>Service</span><b>{request.service}</b></div><div><span>Lieu</span><b>{request.location?.label||request.location||request.district||"Non précisé"}</b></div><div><span>Responsable</span><b>{request.assignedToName||"Non assigné"}</b></div><div><span>Dernière mise à jour</span><b>{request.updated}</b></div></div></article>

        <article className="portal-card"><span className="section-label">Historique complet</span><h3>Timeline du dossier</h3><div className="activity-feed request-timeline-v50">{history.map((item,index)=><div key={item.key||index}><i>{item.isPublic===false?"◆":"●"}</i><div><b>{item.title||item.label}</b>{item.message?<small>{item.message}</small>:null}<span>{item.actorName?`${item.actorName} · `:""}{displayDate(item.createdAt||item.at)}{item.isPublic===false?" · interne":""}</span></div></div>)}</div></article>

        <article className="portal-card portal-card--wide request-workbench">
          <div><span className="section-label">Traitement</span><h3>Faire avancer le dossier</h3><p className="detail-copy">Le résumé est obligatoire lorsque le citoyen doit agir ou lorsque le dossier est clôturé.</p></div>
          <div className="request-workbench-grid"><label><span>Résumé / décision / information demandée</span><textarea value={form.resolution_summary} onChange={e=>setForm(v=>({...v,resolution_summary:e.target.value}))} placeholder="Ex. Merci de fournir un justificatif de domicile..."/></label><div className="action-buttons"><button className="secondary-action" disabled={saving} onClick={takeOwnership}>Prendre en charge</button><button className="secondary-action" disabled={saving} onClick={()=>{setForm(v=>({...v,status:"action_required"}));}}>Demander une information</button><button className="primary-action" disabled={saving} onClick={()=>saveChanges()}>{saving?"Enregistrement…":"Enregistrer les changements"}</button></div></div>
          {sensitiveStatus?<p className="field-help field-help--important">Un résumé est requis pour l’état sélectionné.</p>:null}
        </article>

        <article className="portal-card request-note-card"><span className="section-label">Communication / note</span><h3>Ajouter une étape</h3><label><span>Titre</span><input value={note.title} onChange={e=>setNote(v=>({...v,title:e.target.value}))}/></label><label><span>Message</span><textarea value={note.message} onChange={e=>setNote(v=>({...v,message:e.target.value}))} placeholder="Information de suivi..."/></label><label className="audit-check"><input type="checkbox" checked={note.is_public} onChange={e=>setNote(v=>({...v,is_public:e.target.checked}))}/><span>Visible par le citoyen</span></label><button className="secondary-action" disabled={saving} onClick={addTimeline}>{note.is_public?"Publier dans le suivi":"Ajouter la note interne"}</button></article>

        <article className="portal-card agent-evidence-card"><span className="section-label">Éléments</span><h3>Pièces jointes et résolution</h3>{request.resolutionSummary?<p className="resolution-box">{request.resolutionSummary}</p>:null}{request.attachments?.length?<div className="document-grid">{request.attachments.map((file,index)=><div className="document-row" key={file.id||file.name||index}><i>{String(file.content_type||file.type||"").includes("image")?"IMG":"DOC"}</i><div><b>{file.original_name||file.name||`Pièce ${index+1}`}</b><span>{file.uploader_name||"Citoyen"}</span></div></div>)}</div>:<span className="empty-inline">Aucun document joint.</span>}
          {request.requestType==="signalement"?<div className="report-agent-tools"><label><span>Ajouter des photos d’intervention</span><input type="file" accept="image/*" multiple onChange={e=>setReportFiles(Array.from(e.target.files||[]))}/></label><label className="audit-check"><input type="checkbox" checked={reportPublic} onChange={e=>setReportPublic(e.target.checked)}/><span>Visibles par le citoyen</span></label><button className="secondary-action" disabled={saving||!reportFiles.length} onClick={uploadReportFiles}>Ajouter les photos</button>{request.isClosed?<button className="secondary-action" disabled={saving} onClick={reopenReport}>Rouvrir le signalement</button>:null}</div>:null}
        </article>
      </section>
    </main>
  </div></div>;
}
