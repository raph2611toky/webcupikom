import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequest, updateAgentRequest } from "../../api/requests.js";
import { getAssignees } from "../../api/citizens.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentRequestDetails({params}){
  const [request,setRequest]=useState(null);
  const [assignees,setAssignees]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let mounted=true;
    Promise.all([getAgentRequest(params.id),getAssignees()])
      .then(([data,a])=>{if(!mounted)return;setRequest(data);setAssignees(a)})
      .catch(e=>mounted&&setError(getApiErrorMessage(e,"Demande introuvable.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[params.id]);

  async function patch(changes,message="Modification enregistrée."){
    if(!request||saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      const next=await updateAgentRequest(request.ref,changes);
      setRequest(next);
      setNotice(message);
    }catch(e){
      setError(getApiErrorMessage(e,"Modification impossible."));
    }finally{
      setSaving(false);
    }
  }

  if(loading)return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Dossier citoyen" title="Chargement"/><main className="portal-content"><div className="loading-card">Chargement…</div></main></div></div>;
  if(error&&!request)return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Dossier citoyen" title="Demande"/><main className="portal-content"><div className="error-card">{error}</div></main></div></div>;

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Dossier citoyen" title={`Demande ${request.ref}`}/>
      <main className="portal-content">
        <button className="back-link" onClick={()=>navigate("/agent/requests")}>← Retour aux demandes</button>
        {error?<div className="error-card" role="alert">{error}</div>:null}
        {notice?<div className="agent-inline-notice" role="status">✓ {notice}</div>:null}

        <section className="agent-detail-head">
          <div><span>{request.service}</span><h2>{request.title}</h2><p>{request.citizen} · créée {request.created}</p></div>
          <div className="agent-detail-controls">
            <label><span>Statut</span><select value={request.status} disabled={saving} onChange={e=>patch({status:e.target.value},"Statut mis à jour.")}><option>Envoyée</option><option>À traiter</option><option>En traitement</option><option>Action requise</option><option>Terminée</option></select></label>
            <label><span>Priorité</span><select value={request.priority} disabled={saving} onChange={e=>patch({priority:e.target.value},"Priorité mise à jour.")}><option>Basse</option><option>Normale</option><option>Haute</option><option>Urgente</option></select></label>
            <label><span>Responsable</span><select value={request.assignedTo??""} disabled={saving} onChange={e=>patch({assigned_to:e.target.value?Number(e.target.value):null},"Responsable mis à jour.")}><option value="">Non assignée</option>{assignees.map(a=><option key={a.id} value={a.id}>{a.display_name} · {a.role}</option>)}</select></label>
          </div>
        </section>

        <section className="portal-grid portal-grid--detail agent-smart-grid">
          <article className="portal-card">
            <span className="section-label">Besoin exprimé</span>
            <h3>Demande citoyenne</h3>
            <p className="detail-copy">{request.description}</p>
            <div className="detail-list compact-detail-list">
              <div><span>Service</span><b>{request.service}</b></div>
              <div><span>Priorité</span><b>{request.priority}</b></div>
              <div><span>Citoyen</span><b>{request.citizen}</b></div>
              <div><span>E-mail</span><b>{request.citizenEmail||"—"}</b></div>
            </div>
          </article>

          <article className="portal-card">
            <span className="section-label">Historique</span>
            <h3>Journal du dossier</h3>
            <div className="activity-feed">
              <div><i>●</i><div><b>Demande reçue</b><span>{request.created}</span></div></div>
              <div><i>●</i><div><b>État actuel : {request.status}</b><span>Mise à jour {request.updated}</span></div></div>
              {request.assignedToName?<div><i>●</i><div><b>Responsable</b><span>{request.assignedToName}</span></div></div>:null}
            </div>
          </article>

          <article className="portal-card portal-card--wide agent-action-card">
            <div><span className="section-label">Actions rapides</span><h3>Faire avancer le dossier</h3></div>
            <div className="action-buttons">
              <button className="secondary-action" disabled={saving} onClick={()=>patch({status:"En traitement"},"Demande prise en charge.")}>Prendre en charge</button>
              <button className="secondary-action" disabled={saving} onClick={()=>patch({status:"Action requise"},"Une action citoyenne est maintenant requise.")}>Demander une information</button>
              <button className="primary-action" disabled={saving||request.statusCode==="completed"} onClick={()=>patch({status:"Terminée"},"Demande terminée.")}>Marquer résolue</button>
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>;
}
