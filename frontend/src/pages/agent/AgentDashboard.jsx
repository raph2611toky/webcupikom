import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentDashboard } from "../../api/dashboards.js";
import { getAgentRequestCount, getAgentRequests } from "../../api/requests.js";
import { getAgentAppointments } from "../../api/appointments.js";
import { getAgentContactMessages } from "../../api/contact.js";
import { getAgentAudit } from "../../api/audit.js";
import { getCitizensPage } from "../../api/citizens.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function firstNumber(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = source?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

export default function AgentDashboard(){
  const [state,setState]=useState({dashboard:{},awaiting:0,needsAction:0,processing:0,requestedAppointments:0,upcomingAppointments:0,unreadMessages:0,citizens:0,requests:[],audit:[]});
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let mounted=true;
    async function load(){
      setLoading(true);setError("");
      const results=await Promise.allSettled([
        getAgentDashboard(),
        getAgentRequestCount({awaiting_handling:true}),
        getAgentRequestCount({needs_action:true}),
        getAgentRequestCount({workflow_state:"agent_processing"}),
        getAgentRequests({needs_action:true,page_size:6}),
        getAgentAppointments({status:"requested"}),
        getAgentAppointments({upcoming:true}),
        getAgentContactMessages(),
        getAgentAudit({mine:"true",page_size:6}),
        getCitizensPage({page_size:1}),
      ]);
      if(!mounted)return;
      const value=(index,fallback)=>results[index].status==="fulfilled"?results[index].value:fallback;
      const messages=value(7,[]);
      setState({
        dashboard:value(0,{}), awaiting:value(1,0), needsAction:value(2,0), processing:value(3,0), requests:value(4,[]),
        requestedAppointments:value(5,[]).length, upcomingAppointments:value(6,[]).length,
        unreadMessages:messages.filter(m=>m.statusCode==="received").length,
        audit:value(8,{results:[]}).results||[], citizens:value(9,{count:0}).count||0,
      });
      if(results.some(r=>r.status==="rejected")) setError("Certaines statistiques n’ont pas pu être chargées, les données disponibles restent affichées.");
      setLoading(false);
    }
    load().catch(e=>{if(mounted){setError(getApiErrorMessage(e,"Impossible de charger le tableau de bord."));setLoading(false)}});
    return()=>{mounted=false};
  },[]);

  const metrics=useMemo(()=>({
    awaiting:firstNumber(state.dashboard,["awaiting_handling","awaiting","pending_requests"],state.awaiting),
    action:firstNumber(state.dashboard,["needs_action","requires_agent_action","action_required"],state.needsAction),
    processing:firstNumber(state.dashboard,["agent_processing","in_progress","active_requests"],state.processing),
    appointments:firstNumber(state.dashboard,["appointments_requested","requested_appointments"],state.requestedAppointments),
  }),[state]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Centre opérationnel" title="Tableau de bord agent" actions={<button className="topbar-cta" onClick={()=>navigate('/agent/requests')}>Traiter la file</button>}/>
    <main className="portal-content agent-dashboard agent-dashboard--v50">
      {loading?<div className="loading-card">Synchronisation de l’activité…</div>:null}
      {error?<div className="agent-soft-warning" role="status">{error}</div>:null}
      <section className="metric-grid metric-grid--4">
        <button className="metric-action" onClick={()=>navigate('/agent/requests?workflow=awaiting_handling')}><span>À prendre en charge</span><strong>{metrics.awaiting}</strong><small>D17 · nouvelles demandes</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/requests?needs_action=true')}><span>Action agent requise</span><strong>{metrics.action}</strong><small>Priorité de traitement</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/requests?workflow=agent_processing')}><span>En traitement</span><strong>{metrics.processing}</strong><small>Dossiers actifs</small></button>
        <button className="metric-action" onClick={()=>navigate('/agent/appointments')}><span>RDV à confirmer</span><strong>{metrics.appointments}</strong><small>{state.upcomingAppointments} rendez-vous à venir</small></button>
      </section>

      <section className="portal-grid agent-dashboard-grid-v50">
        <article className="portal-card agent-attention-card">
          <div className="portal-card__head"><div><span className="section-label">File prioritaire</span><h3>Demandes qui nécessitent une action</h3></div><button onClick={()=>navigate('/agent/requests?needs_action=true')}>Tout voir →</button></div>
          <div className="agent-queue">{state.requests.map(r=><button key={r.ref} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref)}`)}><span className="mono">{r.ref}</span><div><strong>{r.citizen}</strong><small>{r.service} · {r.priority}</small></div><em className={`status-pill status-${String(r.status).replaceAll(' ','-').toLowerCase()}`}>{r.workflowLabel||r.status}</em></button>)}{!state.requests.length?<p className="detail-copy">Aucune demande prioritaire actuellement.</p>:null}</div>
        </article>

        <article className="portal-card agent-command-card">
          <span className="section-label">Vue opérationnelle</span><h3>Services à surveiller</h3>
          <div className="command-grid">
            <button onClick={()=>navigate('/agent/messages')}><strong>{state.unreadMessages}</strong><span>Messages non traités</span><small>Relations citoyennes</small></button>
            <button onClick={()=>navigate('/agent/citizens')}><strong>{state.citizens}</strong><span>Comptes citoyens</span><small>Administration F34</small></button>
            <button onClick={()=>navigate('/agent/appointments')}><strong>{state.upcomingAppointments}</strong><span>Rendez-vous à venir</span><small>Agenda F39</small></button>
            <button onClick={()=>navigate('/agent/audit')}><strong>{state.audit.length}</strong><span>Actions récentes</span><small>Audit F47 / F48</small></button>
          </div>
        </article>

        <article className="portal-card agent-audit-preview">
          <div className="portal-card__head"><div><span className="section-label">Traçabilité</span><h3>Mon activité récente</h3></div><button onClick={()=>navigate('/agent/audit?mine=true')}>Journal complet →</button></div>
          <div className="activity-feed">{state.audit.map(item=><div key={item.id}><i aria-hidden="true">●</i><div><b>{item.summary}</b><span>{item.createdLabel} · {item.resourceReference||item.resourceType}</span></div></div>)}{!state.audit.length?<p className="detail-copy">Aucune action récente retournée par le journal.</p>:null}</div>
        </article>

        <article className="portal-card agent-shortcuts-card">
          <span className="section-label">Accès rapide</span><h3>Actions du quotidien</h3>
          <div className="agent-management">
            <button onClick={()=>navigate('/agent/requests')}><i>◎</i><div><b>Demandes citoyennes</b><span>Qualifier, assigner, traiter et documenter</span></div><em>→</em></button>
            <button onClick={()=>navigate('/agent/messages')}><i>✉</i><div><b>Messages reçus</b><span>Lire, assigner et clôturer</span></div><em>→</em></button>
            <button onClick={()=>navigate('/agent/citizens')}><i>◉</i><div><b>Comptes citoyens</b><span>Rechercher, corriger ou désactiver</span></div><em>→</em></button>
            <button onClick={()=>navigate('/agent/audit')}><i>⌁</i><div><b>Journal d’activité</b><span>Retrouver qui a modifié quoi</span></div><em>→</em></button>
          </div>
        </article>
      </section>
    </main>
  </div></div>;
}
