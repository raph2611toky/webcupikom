import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentDashboard } from "../../api/dashboards.js";
import { getAgentRequestCount, getAgentRequests, normalizeRequestForAgent } from "../../api/requests.js";
import { getAgentAppointments } from "../../api/appointments.js";
import { getAgentContactMessages } from "../../api/contact.js";
import { getAgentAudit, normalizeAuditEvent } from "../../api/audit.js";
import { getCitizensPage } from "../../api/citizens.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function pad(value){return String(value).padStart(2,"0")}
function localDateKey(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function numberOrNull(value){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}
function pathValue(source,path){
  return path.split(".").reduce((value,key)=>value&&typeof value==="object"?value[key]:undefined,source);
}
function dashboardNumber(source,paths=[],aliases=[]){
  for(const path of paths){const n=numberOrNull(pathValue(source,path));if(n!==null)return n}
  const wanted=new Set(aliases.map(x=>String(x).toLowerCase()));
  const seen=new Set();
  function walk(value,depth=0){
    if(!value||typeof value!=="object"||depth>4||seen.has(value))return null;seen.add(value);
    for(const [key,child] of Object.entries(value)){
      if(wanted.has(String(key).toLowerCase())){const n=numberOrNull(child);if(n!==null)return n}
    }
    for(const child of Object.values(value)){const n=walk(child,depth+1);if(n!==null)return n}
    return null;
  }
  return walk(source);
}
function dashboardArray(source,paths=[]){
  for(const path of paths){const value=pathValue(source,path);if(Array.isArray(value))return value}
  return null;
}
function normalizeDashboardRequests(rows){
  if(!Array.isArray(rows))return [];
  return rows.map(row=>{
    try{return row?.ref&&row?.statusCode?row:normalizeRequestForAgent(row)}catch{return row}
  }).filter(Boolean);
}
function normalizeDashboardAudit(rows){
  if(!Array.isArray(rows))return [];
  return rows.map(row=>{
    try{return row?.createdLabel?row:normalizeAuditEvent(row)}catch{return row}
  }).filter(Boolean);
}
function newestFirst(rows=[]){
  return [...rows].sort((a,b)=>new Date(b.updatedAt||b.updated_at||b.createdAt||b.created_at||0)-new Date(a.updatedAt||a.updated_at||a.createdAt||a.created_at||0));
}

export default function AgentDashboard(){
  const [state,setState]=useState({
    dashboard:{}, dashboardAvailable:false,
    totalRequests:0, awaiting:0, needsAction:0, processing:0, reports:0,
    appointmentsToday:0, requestedAppointments:0, upcomingAppointments:0,
    unreadMessages:0, citizens:0, recentRequests:[], priorityRequests:[], audit:[],
  });
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let mounted=true;
    async function load(){
      setLoading(true);setError("");
      let dashboard={};let dashboardAvailable=false;
      try{dashboard=await getAgentDashboard()||{};dashboardAvailable=true}catch{/* les appels ciblés ci-dessous servent de repli */}

      const server={
        totalRequests:dashboardNumber(dashboard,["requests.total","requests.count","request_counts.total","counts.requests","counts.total_requests"],["total_requests","requests_count","request_count"]),
        awaiting:dashboardNumber(dashboard,["requests.awaiting_handling","requests.awaiting","request_counts.awaiting_handling","counts.awaiting_handling"],["awaiting_handling","awaiting_requests"]),
        needsAction:dashboardNumber(dashboard,["requests.needs_action","requests.action_required","request_counts.needs_action","counts.needs_action"],["needs_action","requires_agent_action","action_required_requests"]),
        processing:dashboardNumber(dashboard,["requests.agent_processing","requests.in_progress","request_counts.agent_processing","counts.agent_processing"],["agent_processing","in_progress_requests","active_requests"]),
        reports:dashboardNumber(dashboard,["reports.total","reports.count","requests.reports","requests.by_type.report","counts.reports"],["total_reports","reports_count","report_count"]),
        appointmentsToday:dashboardNumber(dashboard,["appointments.today","appointments.today_count","counts.appointments_today"],["appointments_today","today_appointments"]),
        requestedAppointments:dashboardNumber(dashboard,["appointments.requested","appointments.to_confirm","counts.requested_appointments"],["appointments_requested","requested_appointments","appointments_to_confirm"]),
        upcomingAppointments:dashboardNumber(dashboard,["appointments.upcoming","counts.upcoming_appointments"],["upcoming_appointments"]),
        unreadMessages:dashboardNumber(dashboard,["messages.received","contact_messages.received","counts.unread_messages"],["unread_messages","received_messages","messages_received"]),
        citizens:dashboardNumber(dashboard,["citizens.total","citizens.count","counts.citizens"],["citizen_count","citizens_count","total_citizens"]),
      };

      const serverRecent=normalizeDashboardRequests(dashboardArray(dashboard,["recent_requests","latest_requests","requests.recent","requests.latest","activity.recent_requests"]));
      const serverPriority=normalizeDashboardRequests(dashboardArray(dashboard,["priority_requests","requests.needs_attention","requests.needs_action_items","activity.needs_action"]));
      const serverAudit=normalizeDashboardAudit(dashboardArray(dashboard,["recent_activity","recent_audit","audit.recent","activity.recent"]));
      const today=localDateKey();

      const jobs=[];
      const add=(key,promise)=>jobs.push({key,promise});
      if(server.totalRequests===null)add("totalRequests",getAgentRequestCount({}));
      if(server.awaiting===null)add("awaiting",getAgentRequestCount({awaiting_handling:true}));
      if(server.needsAction===null)add("needsAction",getAgentRequestCount({needs_action:true}));
      if(server.processing===null)add("processing",getAgentRequestCount({workflow_state:"agent_processing"}));
      if(server.reports===null)add("reports",getAgentRequestCount({type:"report"}));
      if(server.appointmentsToday===null)add("appointmentsToday",getAgentAppointments({date_from:today,date_to:today}).then(rows=>rows.length));
      if(server.requestedAppointments===null)add("requestedAppointments",getAgentAppointments({status:"requested"}).then(rows=>rows.length));
      if(server.upcomingAppointments===null)add("upcomingAppointments",getAgentAppointments({upcoming:true}).then(rows=>rows.length));
      if(server.unreadMessages===null)add("unreadMessages",getAgentContactMessages().then(rows=>rows.filter(m=>m.statusCode==="received").length));
      if(server.citizens===null)add("citizens",getCitizensPage({page_size:1}).then(page=>page.count||0));
      if(!serverRecent.length)add("recentRequests",getAgentRequests({page_size:8}).then(rows=>newestFirst(rows).slice(0,6)));
      if(!serverPriority.length)add("priorityRequests",getAgentRequests({needs_action:true,page_size:6}));
      if(!serverAudit.length)add("audit",getAgentAudit({mine:"true",page_size:6}).then(page=>page.results||[]));

      const settled=await Promise.allSettled(jobs.map(job=>job.promise));
      if(!mounted)return;
      const fallback={};let failures=0;
      settled.forEach((result,index)=>{if(result.status==="fulfilled")fallback[jobs[index].key]=result.value;else failures+=1});

      setState({
        dashboard,dashboardAvailable,
        totalRequests:server.totalRequests??fallback.totalRequests??0,
        awaiting:server.awaiting??fallback.awaiting??0,
        needsAction:server.needsAction??fallback.needsAction??0,
        processing:server.processing??fallback.processing??0,
        reports:server.reports??fallback.reports??0,
        appointmentsToday:server.appointmentsToday??fallback.appointmentsToday??0,
        requestedAppointments:server.requestedAppointments??fallback.requestedAppointments??0,
        upcomingAppointments:server.upcomingAppointments??fallback.upcomingAppointments??0,
        unreadMessages:server.unreadMessages??fallback.unreadMessages??0,
        citizens:server.citizens??fallback.citizens??0,
        recentRequests:serverRecent.length?newestFirst(serverRecent).slice(0,6):(fallback.recentRequests||[]),
        priorityRequests:serverPriority.length?serverPriority.slice(0,6):(fallback.priorityRequests||[]),
        audit:serverAudit.length?serverAudit.slice(0,6):(fallback.audit||[]),
      });
      if(failures&&(!dashboardAvailable||Object.values(server).every(value=>value===null))){
        setError("Certaines statistiques ne sont pas disponibles côté API ; les données accessibles restent affichées.");
      }
      setLoading(false);
    }
    load().catch(e=>{if(mounted){setError(getApiErrorMessage(e,"Impossible de charger le tableau de bord."));setLoading(false)}});
    return()=>{mounted=false};
  },[]);

  const completion=useMemo(()=>state.totalRequests?Math.round(((state.totalRequests-state.awaiting)/state.totalRequests)*100):0,[state.totalRequests,state.awaiting]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Centre opérationnel" title="Tableau de bord agent" actions={<button className="topbar-cta" onClick={()=>navigate('/agent/requests')}>Traiter la file</button>}/>
    <main className="portal-content agent-dashboard agent-dashboard--v52">
      {loading?<div className="loading-card">Synchronisation de l’activité…</div>:null}
      {error?<div className="agent-soft-warning" role="status">{error}</div>:null}
      <div className="dashboard-source-note" role="status"><span aria-hidden="true">●</span>{state.dashboardAvailable?"Tableau de bord consolidé depuis /agent/dashboard/ ; repli automatique uniquement pour les compteurs absents.":"/agent/dashboard/ indisponible : compteurs reconstruits depuis les endpoints métier."}</div>

      <section className="metric-grid agent-dashboard-kpis" aria-label="Indicateurs principaux de l'activité agent">
        <button className="metric-action" onClick={()=>navigate('/agent/requests')}><span>Demandes totales</span><strong>{state.totalRequests}</strong><small>{completion}% déjà prises en charge</small></button>
        <button className="metric-action metric-action--attention" onClick={()=>navigate('/agent/requests?workflow=awaiting_handling')}><span>À prendre en charge</span><strong>{state.awaiting}</strong><small>D17 · nouvelles demandes</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/requests?workflow=agent_processing')}><span>En traitement</span><strong>{state.processing}</strong><small>Dossiers actifs</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/requests?needs_action=true')}><span>Action requise</span><strong>{state.needsAction}</strong><small>Attention de l’agent</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/signalements')}><span>Signalements</span><strong>{state.reports}</strong><small>Incidents citoyens</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/appointments')}><span>Rendez-vous aujourd’hui</span><strong>{state.appointmentsToday}</strong><small>{state.requestedAppointments} à confirmer · {state.upcomingAppointments} à venir</small></button>
      </section>

      <section className="portal-grid agent-dashboard-grid-v52">
        <article className="portal-card agent-attention-card">
          <div className="portal-card__head"><div><span className="section-label">D17 · File prioritaire</span><h3>À traiter maintenant</h3></div><button onClick={()=>navigate('/agent/requests?needs_action=true')}>Tout voir →</button></div>
          <div className="agent-queue">{state.priorityRequests.map(r=><button key={r.ref||r.reference||r.id} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref||r.reference||r.id)}`)}><span className="mono">{r.ref||r.reference||r.id}</span><div><strong>{r.citizen||r.citizen_name||"Citoyen"}</strong><small>{r.service||r.service_name||"Service municipal"} · {r.priority||r.priority_label||"Normale"}</small></div><em className={`status-pill status-${String(r.status||r.status_label||"").replaceAll(' ','-').toLowerCase()}`}>{r.workflowLabel||r.status||r.status_label||"À traiter"}</em></button>)}{!state.priorityRequests.length?<p className="detail-copy">Aucune demande nécessitant une action immédiate.</p>:null}</div>
        </article>

        <article className="portal-card agent-recent-requests">
          <div className="portal-card__head"><div><span className="section-label">F50 · Activité</span><h3>Derniers dossiers</h3></div><button onClick={()=>navigate('/agent/requests')}>File complète →</button></div>
          <div className="recent-request-list">{state.recentRequests.map(r=><button key={r.ref||r.reference||r.id} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref||r.reference||r.id)}`)}><div><span className="mono">{r.ref||r.reference||r.id}</span><strong>{r.title||"Demande citoyenne"}</strong><small>{r.citizen||r.citizen_name||"Citoyen"} · {r.service||r.service_name||"Service municipal"}</small></div><em>{r.workflowLabel||r.status||r.status_label||"—"}</em></button>)}{!state.recentRequests.length?<p className="detail-copy">Aucun dossier récent retourné par l’API.</p>:null}</div>
        </article>

        <article className="portal-card agent-command-card">
          <span className="section-label">Vue opérationnelle</span><h3>Services à surveiller</h3>
          <div className="command-grid">
            <button onClick={()=>navigate('/agent/messages')}><strong>{state.unreadMessages}</strong><span>Messages non traités</span><small>Relations citoyennes</small></button>
            <button onClick={()=>navigate('/agent/citizens')}><strong>{state.citizens}</strong><span>Comptes citoyens</span><small>Administration F34</small></button>
            <button onClick={()=>navigate('/agent/appointments')}><strong>{state.upcomingAppointments}</strong><span>Rendez-vous à venir</span><small>Agenda F39</small></button>
            <button onClick={()=>navigate('/agent/audit')}><strong>{state.audit.length}</strong><span>Actions récentes</span><small>Audit F47 / F48</small></button>
            <button onClick={()=>navigate('/agent/projects')}><strong>✦</strong><span>Projets municipaux</span><small>Participation F65–F68</small></button>
          </div>
        </article>

        <article className="portal-card agent-audit-preview">
          <div className="portal-card__head"><div><span className="section-label">Traçabilité</span><h3>Mon activité récente</h3></div><button onClick={()=>navigate('/agent/audit?mine=true')}>Journal complet →</button></div>
          <div className="activity-feed">{state.audit.map(item=><div key={item.id||`${item.action}-${item.createdAt}`}><i aria-hidden="true">●</i><div><b>{item.summary||item.action||"Action enregistrée"}</b><span>{item.createdLabel||""} · {item.resourceReference||item.resourceType||"Ressource"}</span></div></div>)}{!state.audit.length?<p className="detail-copy">Aucune action récente retournée par le journal.</p>:null}</div>
        </article>
      </section>
    </main>
  </div></div>;
}
