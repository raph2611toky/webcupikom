import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAdminRequestSummary, getAdminRequestsPage, getAgentRequestSummary, getAgentRequestsPage } from "../../api/requests.js";
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
    reply:q.get("reply")||"all",
  };
}

export default function AgentRequests({ mode = "agent" } = {}){
  const isAdmin=mode==="admin";
  const Sidebar=isAdmin?AdminSidebar:AgentSidebar;
  const listRequests=isAdmin?getAdminRequestsPage:getAgentRequestsPage;
  const loadSummary=isAdmin?getAdminRequestSummary:getAgentRequestSummary;
  const requestBase=isAdmin?"/admin/requests":"/agent/requests";
  const initial=initialFilters();
  if(new URLSearchParams(window.location.search).get("needs_action")==="true") initial.workflow="needs_action";
  const [filters,setFilters]=useState(initial);
  const [rows,setRows]=useState([]);
  const [services,setServices]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [hasNext,setHasNext]=useState(false);
  const [hasPrevious,setHasPrevious]=useState(false);
  const [metrics,setMetrics]=useState({awaiting:0,action:0,processing:0,waitingCitizen:0,answered:0,awaitingReply:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{getServices().then(setServices).catch(()=>{})},[]);
  useEffect(()=>{
    loadSummary().then((summary)=>setMetrics({
      awaiting:Number(summary.awaiting_handling||0),
      action:Number(summary.needs_agent_action??summary.needs_action??0),
      processing:Number(summary.in_progress??summary.agent_processing??0),
      waitingCitizen:Number(summary.waiting_citizen??summary.action_required??0),
      answered:Number(summary.answered||0),
      awaitingReply:Number(summary.awaiting_first_reply||0),
    })).catch(()=>{});
  },[isAdmin]);

  useEffect(()=>{
    let active=true;
    const timer=window.setTimeout(()=>{
      setLoading(true);setError("");
      const params={page,page_size:30,search:filters.query,service:filters.service,priority:filters.priority,type:filters.type};
      if(filters.reply==="answered")params.has_agent_reply=true;
      if(filters.reply==="unanswered")params.has_agent_reply=false;
      if(filters.workflow==="needs_action")params.needs_action=true;
      else if(filters.workflow==="awaiting_handling")params.awaiting_handling=true;
      else if(filters.workflow!=="all")params.workflow_state=filters.workflow;
      listRequests(params).then(result=>{if(active){setRows(result.results);setTotal(result.count);setHasNext(Boolean(result.next));setHasPrevious(Boolean(result.previous))}}).catch(e=>active&&setError(getApiErrorMessage(e,"Impossible de charger les demandes."))).finally(()=>active&&setLoading(false));
    },180);
    return()=>{active=false;window.clearTimeout(timer)};
  },[filters,page]);

  const hasFilters=useMemo(()=>filters.workflow!=="all"||filters.query||filters.service||filters.priority||filters.type||filters.reply!=="all",[filters]);

  return <div className="portal-layout"><Sidebar/><div className="portal-main">
    <PortalTopbar eyebrow={isAdmin?"Administration":"Traitement"} title={isAdmin?"Supervision des demandes":"Demandes citoyennes"}/>
    <main className="portal-content agent-requests-v50">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="metric-grid metric-grid--4 compact-agent-metrics">
        <button className="metric-action" onClick={()=>{setFilters(v=>({...v,workflow:"awaiting_handling"}));setPage(1)}}><span>À prendre en charge</span><strong>{metrics.awaiting}</strong><small>Non traitées</small></button>
        <button className="metric-action" onClick={()=>{setFilters(v=>({...v,workflow:"needs_action"}));setPage(1)}}><span>Action requise</span><strong>{metrics.action}</strong><small>Côté agent</small></button>
        <button className="metric-action" onClick={()=>{setFilters(v=>({...v,workflow:"agent_processing"}));setPage(1)}}><span>En traitement</span><strong>{metrics.processing}</strong><small>Dossiers actifs</small></button>
        <button className="metric-action" onClick={()=>{setFilters(v=>({...v,workflow:"citizen_action_required"}));setPage(1)}}><span>Attente citoyen</span><strong>{metrics.waitingCitizen}</strong><small>Information demandée</small></button>
      </section>

      <section className="request-communication-summary" aria-label="Résumé des réponses municipales">
        <div><span>Réponses envoyées</span><strong>{metrics.answered}</strong></div>
        <div className={metrics.awaitingReply ? "needs-reply" : ""}><span>Sans première réponse</span><strong>{metrics.awaitingReply}</strong></div>
        <p>Le filtre « Réponses » permet d’isoler rapidement les dossiers qui attendent encore un premier retour municipal.</p>
      </section>

      <section className="toolbar-card toolbar-card--stack" aria-label="Filtres des demandes">
        <div className="toolbar-line agent-filter-grid">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une demande citoyenne" value={filters.query} onChange={e=>{setFilters(v=>({...v,query:e.target.value}));setPage(1)}} placeholder="Référence, citoyen, description..."/></label>
          <label><span className="sr-only">Service</span><select value={filters.service} onChange={e=>{setFilters(v=>({...v,service:e.target.value}));setPage(1)}}><option value="">Tous les services</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label><span className="sr-only">Priorité</span><select value={filters.priority} onChange={e=>{setFilters(v=>({...v,priority:e.target.value}));setPage(1)}}><option value="">Toutes priorités</option><option value="urgent">Urgente</option><option value="high">Haute</option><option value="normal">Normale</option><option value="low">Basse</option></select></label>
          <label><span className="sr-only">Type</span><select value={filters.type} onChange={e=>{setFilters(v=>({...v,type:e.target.value}));setPage(1)}}><option value="">Demandes + signalements</option><option value="procedure">Démarches</option><option value="report">Signalements</option></select></label>
          <label><span className="sr-only">Réponses</span><select value={filters.reply} onChange={e=>{setFilters(v=>({...v,reply:e.target.value}));setPage(1)}}><option value="all">Toutes communications</option><option value="unanswered">Sans réponse municipale</option><option value="answered">Avec réponse municipale</option></select></label>
        </div>
        <div className="filter-row filter-row--portal agent-flow-filters" role="group" aria-label="État de traitement">
          {FLOW_FILTERS.map(([value,label])=><button type="button" aria-pressed={filters.workflow===value} key={value} className={filters.workflow===value?"is-active":""} onClick={()=>{setFilters(v=>({...v,workflow:value}));setPage(1)}}>{label}</button>)}
          {hasFilters?<button className="filter-reset" type="button" onClick={()=>{setFilters({workflow:"all",query:"",service:"",priority:"",type:"",reply:"all"});setPage(1)}}>Réinitialiser</button>:null}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card__head"><div><span className="section-label">File de travail</span><h3>{total} demande{total>1?"s":""}</h3></div><span className="request-list-hint">Les filtres sont appliqués côté serveur</span></div>
        {loading?<div className="loading-card">Chargement…</div>:<div className="accessible-table-wrap"><table className="accessible-table agent-request-table">
          <caption className="sr-only">Liste des demandes citoyennes</caption>
          <thead><tr><th scope="col">Référence</th><th scope="col">Citoyen / demande</th><th scope="col">Service</th><th scope="col">Priorité</th><th scope="col">État opérationnel</th><th scope="col">Responsable</th><th scope="col">Action</th></tr></thead>
          <tbody>{rows.map(row=><tr key={row.ref} className={row.requiresAgentAction?"row-needs-action":""}>
            <td className="mono">{row.ref}</td>
            <td><strong>{row.citizen}</strong><small>{row.title||row.category||"Demande citoyenne"}</small>{row.hasAgentReply?<small className="agent-reply-state">↩ {row.agentReplyCount} réponse{row.agentReplyCount>1?"s":""}</small>:<small className="agent-reply-state is-waiting">Sans réponse</small>}</td>
            <td>{row.service}{row.needsTriage?<small className="triage-flag">À router</small>:null}</td>
            <td><span className={`priority-badge priority-${row.priorityCode}`}>{row.priority}</span></td>
            <td><span className={`status-pill status-${String(row.status).replaceAll(" ","-").toLowerCase()}`}>{row.workflowLabel||row.status}</span>{row.requiresAgentAction?<small className="attention-label">Action attendue</small>:row.requiresCitizenAction?<small className="citizen-wait-label">Attente citoyen</small>:null}</td>
            <td>{row.assignedToName||"Non assigné"}</td>
            <td><button className="accessible-table__action" type="button" onClick={()=>navigate(`${requestBase}/${encodeURIComponent(row.ref)}`)} aria-label={`Ouvrir la demande ${row.ref}`}>Ouvrir <span aria-hidden="true">→</span></button></td>
          </tr>)}{!rows.length?<tr><td colSpan="7"><p className="detail-copy">Aucune demande pour ces filtres.</p></td></tr>:null}</tbody>
        </table></div>}
        {total>30?<div className="staff-request-pagination" aria-label="Pagination des demandes"><button type="button" className="secondary-action" disabled={!hasPrevious||loading} onClick={()=>setPage(v=>Math.max(1,v-1))}>← Précédent</button><span>Page {page}</span><button type="button" className="secondary-action" disabled={!hasNext||loading} onClick={()=>setPage(v=>v+1)}>Suivant →</button></div>:null}
      </section>
    </main>
  </div></div>;
}
