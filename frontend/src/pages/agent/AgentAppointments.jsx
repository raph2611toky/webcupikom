import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import {
  getAgentAppointments,
  getAgentAppointmentSummary,
  getAppointmentStatusLabel,
  updateAgentAppointment,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const FILTERS = [
  ["all","Tous"],["requested","En attente"],["confirmed","Confirmés"],["completed","Terminés"],["cancelled","Annulés"],["declined","Refusés"],
];

function formatDate(date) {
  if (!date) return "—";
  try {return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short"}).format(new Date(`${date}T12:00:00`))}
  catch{return date}
}

export default function AgentAppointments() {
  const [appointments,setAppointments]=useState([]);
  const [summary,setSummary]=useState({});
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [savingReference,setSavingReference]=useState("");

  const visible=useMemo(()=>appointments.filter(item=>
    (filter==="all"||item.status===filter) &&
    (!query||`${item.reference} ${item.citizenName} ${item.citizenEmail} ${item.serviceName} ${item.reason} ${item.agentName}`.toLowerCase().includes(query.toLowerCase()))
  ),[appointments,filter,query]);

  async function loadAppointments(){
    const [rows,nextSummary]=await Promise.all([getAgentAppointments(),getAgentAppointmentSummary()]);
    setAppointments(rows);setSummary(nextSummary||{});
  }

  useEffect(()=>{
    let mounted=true;
    loadAppointments()
      .catch(err=>mounted&&setError(getApiErrorMessage(err,"Impossible de charger les rendez-vous.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[]);

  async function setStatus(item,status){
    setError("");setNotice("");setSavingReference(item.reference);
    try{
      const patch={status};
      if(status==="confirmed"){
        const location=window.prompt("Lieu du rendez-vous (facultatif)",item.location||"");
        if(location!==null&&location.trim())patch.location=location.trim();
      }
      await updateAgentAppointment(item.reference,patch);
      setNotice(`Rendez-vous ${getAppointmentStatusLabel(status).toLowerCase()}.`);
      await loadAppointments();
    }catch(err){setError(getApiErrorMessage(err,"Impossible de mettre à jour le rendez-vous."))}
    finally{setSavingReference("")}
  }

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Organisation" title="Rendez-vous citoyens"/>
    <main className="portal-content appointment-agent-page">
      {loading?<div className="loading-card">Chargement…</div>:null}
      {notice?<div className="success-inline" role="status">{notice}</div>:null}
      {error?<div className="error-card" role="alert">{error}</div>:null}

      <section className="metric-grid metric-grid--4 appointment-agent-metrics">
        <article><span>Aujourd’hui</span><strong>{summary.today||0}</strong><small>Rendez-vous du jour</small></article>
        <article><span>En attente</span><strong>{summary.requested||0}</strong><small>À confirmer</small></article>
        <article><span>Confirmés</span><strong>{summary.confirmed||0}</strong><small>{summary.upcoming||0} à venir</small></article>
        <article><span>Terminés</span><strong>{summary.completed||0}</strong><small>{summary.declined||0} refusés</small></article>
      </section>

      <section className="portal-card appointment-agent-list">
        <div className="portal-card__head"><div><span className="section-label">Agenda backend</span><h3>Rendez-vous reçus</h3></div><button type="button" className="secondary-action" onClick={()=>loadAppointments().catch(err=>setError(getApiErrorMessage(err,"Impossible d’actualiser.")))}>Actualiser</button></div>
        <label className="portal-search appointment-agent-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, service..."/></label>
        <div className="management-filter-row appointment-filter-row">{FILTERS.map(([value,label])=><button type="button" key={value} className={filter===value?"is-active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div>
        <div className="agent-appointment-list">
          {visible.length?visible.map(item=><article key={item.reference} className={`agent-appointment status-${item.status}`}>
            <div className="agent-appointment__time"><b>{item.startTime||"—"}</b><span>{formatDate(item.date)}</span></div>
            <div className="agent-appointment__body">
              <div className="agent-appointment__title"><strong>{item.citizenName}</strong><em>{getAppointmentStatusLabel(item.status)}</em></div>
              <span>{item.serviceName} · {item.reference}</span><p>{item.reason||"Motif non précisé"}</p>
              <div className="agent-appointment__meta"><small>{item.citizenEmail||"—"}</small>{item.location?<small>Lieu : {item.location}</small>:null}</div>
              <div className="agent-appointment__actions">
                {item.status==="requested"?<><button className="primary-action" disabled={savingReference===item.reference} type="button" onClick={()=>setStatus(item,"confirmed")}>Confirmer</button><button className="text-danger" disabled={savingReference===item.reference} type="button" onClick={()=>setStatus(item,"declined")}>Refuser</button></>:null}
                {item.status==="confirmed"?<><button className="primary-action" disabled={savingReference===item.reference} type="button" onClick={()=>setStatus(item,"completed")}>Terminer</button><button className="text-danger" disabled={savingReference===item.reference} type="button" onClick={()=>setStatus(item,"cancelled")}>Annuler</button></>:null}
              </div>
            </div>
          </article>):<div className="dashboard-empty">Aucun rendez-vous dans ce filtre.</div>}
        </div>
      </section>
    </main>
  </div></div>;
}
