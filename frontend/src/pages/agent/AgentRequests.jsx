import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequestCount, getAgentRequestsPage } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

const FLOW_FILTERS = [
  ["all","Toutes"],
  ["awaiting_handling","À prendre en charge"],
  ["agent_processing","En traitement"],
  ["citizen_action_required","Attente citoyen"],
  ["needs_action","Action requise"],
  ["closed","Clôturées"],
];

function initialFilters(){
  const q=new URLSearchParams(window.location.search);
  return {
    workflow:q.get("workflow")||"all",
    query:q.get("search")||"",
    service:q.get("service")||"",
    priority:q.get("priority")||"",
    type:q.get("type")||"",
  };
}

export default function AgentRequests(){
  const initial=initialFilters();
  if(new URLSearchParams(window.location.search).get("needs_action")==="true") initial.workflow="needs_action";
  const [filters,setFilters]=useState(initial);
  const [rows,setRows]=useState([]);
  const [services,setServices]=useState([]);
  const [total,setTotal]=useState(0);
  const [metrics,setMetrics]=useState({awaiting:0,action:0,processing:0,waitingCitizen:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{getServices().then(setServices).catch(()=>{})},[]);
  useEffect(()=>{
    Promise.all([
      getAgentRequestCount({awaiting_handling:true}),
      getAgentRequestCount({needs_action:true}),
      getAgentRequestCount({workflow_state:"agent_processing"}),
      getAgentRequestCount({workflow_state:"citizen_action_required"}),
    ]).then(([awaiting,action,processing,waitingCitizen])=>setMetrics({awaiting,action,processing,waitingCitizen})).catch(()=>{});
  },[]);

  useEffect(()=>{
    let active=true;
    const timer=window.setTimeout(()=>{
      setLoading(true);setError("");
      const params={page_size:100,search:filters.query,service:filters.service,priority:filters.priority,type:filters.type};
      if(filters.workflow==="needs_action")params.needs_action=true;
      else if(filters.workflow==="awaiting_handling")params.awaiting_handling=true;
      else if(filters.workflow!=="all")params.workflow_state=filters.workflow;
      getAgentRequestsPage(params).then(page=>{if(active){setRows(page.results);setTotal(page.count)}}).catch(e=>active&&setError(getApiErrorMessage(e,"Impossible de charger les demandes."))).finally(()=>active&&setLoading(false));
    },180);
    return()=>{active=false;window.clearTimeout(timer)};
  },[filters]);

  const hasFilters=useMemo(()=>filters.workflow!=="all"||filters.query||filters.service||filters.priority||filters.type,[filters]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Traitement" title="Demandes citoyennes"/>
    <main className="portal-content agent-requests-v50">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="metric-grid metric-grid--4 compact-agent-metrics">
        <button className="metric-action" onClick={()=>setFilters(v=>({...v,workflow:"awaiting_handling"}))}><span>À prendre en charge</span><strong>{metrics.awaiting}</strong><small>Non traitées</small></button>
        <button className="metric-action" onClick={()=>setFilters(v=>({...v,workflow:"needs_action"}))}><span>Action requise</span><strong>{metrics.action}</strong><small>Côté agent</small></button>
        <button className="metric-action" onClick={()=>setFilters(v=>({...v,workflow:"agent_processing"}))}><span>En traitement</span><strong>{metrics.processing}</strong><small>Dossiers actifs</small></button>
        <button className="metric-action" onClick={()=>setFilters(v=>({...v,workflow:"citizen_action_required"}))}><span>Attente citoyen</span><strong>{metrics.waitingCitizen}</strong><small>Information demandée</small></button>
      </section>

      <section className="toolbar-card toolbar-card--stack" aria-label="Filtres des demandes">
        <div className="toolbar-line agent-filter-grid">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une demande citoyenne" value={filters.query} onChange={e=>setFilters(v=>({...v,query:e.target.value}))} placeholder="Référence, citoyen, description..."/></label>
          <label><span className="sr-only">Service</span><select value={filters.service} onChange={e=>setFilters(v=>({...v,service:e.target.value}))}><option value="">Tous les services</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label><span className="sr-only">Priorité</span><select value={filters.priority} onChange={e=>setFilters(v=>({...v,priority:e.target.value}))}><option value="">Toutes priorités</option><option value="urgent">Urgente</option><option value="high">Haute</option><option value="normal">Normale</option><option value="low">Basse</option></select></label>
          <label><span className="sr-only">Type</span><select value={filters.type} onChange={e=>setFilters(v=>({...v,type:e.target.value}))}><option value="">Demandes + signalements</option><option value="procedure">Démarches</option><option value="report">Signalements</option></select></label>
        </div>
        <div className="filter-row filter-row--portal agent-flow-filters" role="group" aria-label="État de traitement">
          {FLOW_FILTERS.map(([value,label])=><button type="button" aria-pressed={filters.workflow===value} key={value} className={filters.workflow===value?"is-active":""} onClick={()=>setFilters(v=>({...v,workflow:value}))}>{label}</button>)}
          {hasFilters?<button className="filter-reset" type="button" onClick={()=>setFilters({workflow:"all",query:"",service:"",priority:"",type:""})}>Réinitialiser</button>:null}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card__head"><div><span className="section-label">File de travail</span><h3>{total} demande{total>1?"s":""}</h3></div><span className="request-list-hint">Les filtres sont appliqués côté serveur</span></div>
        {loading?<div className="loading-card">Chargement…</div>:<div className="accessible-table-wrap"><table className="accessible-table agent-request-table">
          <caption className="sr-only">Liste des demandes citoyennes</caption>
          <thead><tr><th scope="col">Référence</th><th scope="col">Citoyen / demande</th><th scope="col">Service</th><th scope="col">Priorité</th><th scope="col">État opérationnel</th><th scope="col">Responsable</th><th scope="col">Action</th></tr></thead>
          <tbody>{rows.map(row=><tr key={row.ref} className={row.requiresAgentAction?"row-needs-action":""}>
            <td className="mono">{row.ref}</td>
            <td><strong>{row.citizen}</strong><small>{row.title||row.category||"Demande citoyenne"}</small></td>
            <td>{row.service}{row.needsTriage?<small className="triage-flag">À router</small>:null}</td>
            <td><span className={`priority-badge priority-${row.priorityCode}`}>{row.priority}</span></td>
            <td><span className={`status-pill status-${String(row.status).replaceAll(" ","-").toLowerCase()}`}>{row.workflowLabel||row.status}</span>{row.requiresAgentAction?<small className="attention-label">Action attendue</small>:row.requiresCitizenAction?<small className="citizen-wait-label">Attente citoyen</small>:null}</td>
            <td>{row.assignedToName||"Non assigné"}</td>
            <td><button className="accessible-table__action" type="button" onClick={()=>navigate(`/agent/requests/${encodeURIComponent(row.ref)}`)} aria-label={`Ouvrir la demande ${row.ref}`}>Ouvrir <span aria-hidden="true">→</span></button></td>
          </tr>)}{!rows.length?<tr><td colSpan="7"><p className="detail-copy">Aucune demande pour ces filtres.</p></td></tr>:null}</tbody>
        </table></div>}
      </section>
    </main>
  </div></div>;
}
