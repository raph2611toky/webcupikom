import { useEffect, useState } from "react";
import { updateServiceAvailability } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { ServiceAvailabilityBadge } from "./ServiceAvailability.jsx";
import "../../styles/service-availability.css";

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0,16);
}

export default function ServiceAvailabilityEditor({ service, role = "agent", onSaved, compact = false }) {
  const [form,setForm]=useState({isAvailable:true,reason:"",alternativeAction:"",expectedRestoreAt:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    setForm({
      isAvailable:service?.isAvailable!==false,
      reason:service?.unavailabilityReason||"",
      alternativeAction:service?.alternativeAction||"",
      expectedRestoreAt:toLocalDateTime(service?.expectedRestoreAt),
    });
    setError("");setNotice("");
  },[service?.slug,service?.isAvailable,service?.unavailabilityReason,service?.alternativeAction,service?.expectedRestoreAt]);

  async function save(event){
    event?.preventDefault?.();
    setError("");setNotice("");
    if(!form.isAvailable&&!form.reason.trim()){
      setError("Indiquez le motif de l’indisponibilité pour que le citoyen comprenne la situation.");return;
    }
    if(!form.isAvailable&&!form.alternativeAction.trim()&&!form.expectedRestoreAt){
      setError("Indiquez au moins une date de retour estimée ou une action alternative.");return;
    }
    setSaving(true);
    try{
      const updated=await updateServiceAvailability(service.slug,{
        isAvailable:form.isAvailable,
        reason:form.isAvailable?"":form.reason.trim(),
        alternativeAction:form.isAvailable?"":form.alternativeAction.trim(),
        expectedRestoreAt:form.isAvailable?"":(form.expectedRestoreAt?new Date(form.expectedRestoreAt).toISOString():""),
      },{role});
      setNotice(form.isAvailable?"Service remis à disposition des habitants.":"Indisponibilité publiée pour les habitants.");
      onSaved?.(updated);
    }catch(e){
      setError(getApiErrorMessage(e,"Impossible de mettre à jour la disponibilité du service."));
    }finally{setSaving(false)}
  }

  return <form className={`service-availability-editor ${compact?"is-compact":""}`} onSubmit={save}>
    <div className="service-availability-editor__head"><div><span className="section-label">F38 · F63 · F64</span><h3>Disponibilité du service</h3></div><ServiceAvailabilityBadge service={{...service,isAvailable:form.isAvailable}}/></div>
    {error?<div className="error-card" role="alert">{error}</div>:null}
    {notice?<div className="success-inline" role="status">✓ {notice}</div>:null}
    <div className="service-availability-editor__state" role="radiogroup" aria-label="État du service">
      <label className={form.isAvailable?"is-selected":""}><input type="radio" name={`availability-${service?.slug}`} checked={form.isAvailable} onChange={()=>setForm(v=>({...v,isAvailable:true}))}/><span><b>Disponible</b><small>Les habitants peuvent commencer une démarche.</small></span></label>
      <label className={!form.isAvailable?"is-selected is-down":""}><input type="radio" name={`availability-${service?.slug}`} checked={!form.isAvailable} onChange={()=>setForm(v=>({...v,isAvailable:false}))}/><span><b>Indisponible</b><small>Une interruption connue est affichée aux habitants.</small></span></label>
    </div>
    {!form.isAvailable?<div className="service-availability-editor__fields">
      <label className="span-2"><span>Motif visible par le citoyen *</span><textarea rows="2" value={form.reason} onChange={e=>setForm(v=>({...v,reason:e.target.value}))} placeholder="Ex. Maintenance du système d’état civil."/></label>
      <label><span>Retour estimé</span><input type="datetime-local" value={form.expectedRestoreAt} onChange={e=>setForm(v=>({...v,expectedRestoreAt:e.target.value}))}/></label>
      <label><span>Prochaine action / alternative</span><input value={form.alternativeAction} onChange={e=>setForm(v=>({...v,alternativeAction:e.target.value}))} placeholder="Ex. Déposer le dossier à l’accueil."/></label>
    </div>:<p className="service-availability-editor__help">Le service sera affiché comme disponible immédiatement dans le catalogue citoyen.</p>}
    <div className="service-availability-editor__actions"><button className="primary-action" disabled={saving}>{saving?"Enregistrement…":"Enregistrer l’état"}</button></div>
  </form>;
}
