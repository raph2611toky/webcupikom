import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import {
  getAdminAppointments,
  getAdminAppointmentSummary,
  getAppointmentStatusLabel,
  updateAdminAppointment,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const FILTERS=[["all","Tous"],["requested","En attente"],["confirmed","Confirmés"],["completed","Terminés"],["cancelled","Annulés"],["declined","Refusés"]];

export default function AdminAppointments(){
  const [appointments,setAppointments]=useState([]);
  const [summary,setSummary]=useState({});
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState("");

  const visible=useMemo(()=>appointments.filter(item=>(filter==="all"||item.status===filter)&&(!query||`${item.reference} ${item.citizenName} ${item.citizenEmail} ${item.serviceName} ${item.agentName}`.toLowerCase().includes(query.toLowerCase()))),[appointments,filter,query]);

  async function loadCore(){
    const [rows,nextSummary]=await Promise.all([getAdminAppointments(),getAdminAppointmentSummary()]);
    setAppointments(rows);setSummary(nextSummary||{});
  }

  useEffect(()=>{loadCore().catch(err=>setError(getApiErrorMessage(err,"Impossible de charger les rendez-vous.")))},[]);

  async function setStatus(item,status){
    setError("");setSaving(item.reference);
    try{
      const patch={status};
      if(status==="confirmed"){
        const location=window.prompt("Lieu du rendez-vous (facultatif)",item.location||"");
        if(location!==null&&location.trim())patch.location=location.trim();
      }
      await updateAdminAppointment(item.reference,patch);
      setNotice(`Rendez-vous ${getAppointmentStatusLabel(status).toLowerCase()}.`);
      await loadCore();
    }catch(err){setError(getApiErrorMessage(err,"Impossible de modifier le rendez-vous."))}
    finally{setSaving("")}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Administration" title="Rendez-vous"/>
    <main className="portal-content admin-appointments-page">
      {notice?<div className="success-inline" role="status">{notice}</div>:null}{error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="metric-grid metric-grid--4"><article><span>Total</span><strong>{summary.total||appointments.length}</strong><small>{summary.today||0} aujourd’hui</small></article><article><span>En attente</span><strong>{summary.requested||0}</strong><small>À organiser</small></article><article><span>Confirmés</span><strong>{summary.confirmed||0}</strong><small>{summary.upcoming||0} à venir</small></article><article><span>Terminés</span><strong>{summary.completed||0}</strong><small>{summary.cancelled||0} annulés</small></article></section>
      <section className="toolbar-card"><div className="toolbar-line"><label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, service, agent..."/></label><button type="button" className="secondary-action" onClick={()=>loadCore().catch(err=>setError(getApiErrorMessage(err,"Impossible d’actualiser.")))}>Actualiser</button></div><div className="filter-row filter-row--portal">{FILTERS.map(([value,label])=><button key={value} type="button" className={filter===value?"is-active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div></section>
      <section className="portal-card"><div className="accessible-table-wrap"><table className="accessible-table"><caption className="sr-only">Tous les rendez-vous</caption><thead><tr><th>Référence</th><th>Citoyen</th><th>Agent</th><th>Service</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{visible.map(item=><tr key={item.reference}><td className="mono">{item.reference}</td><td><strong>{item.citizenName}</strong><small>{item.citizenEmail}</small></td><td>{item.agentName}</td><td>{item.serviceName}</td><td>{item.date} · {item.startTime}</td><td><span className={`status-pill status-${item.status}`}>{getAppointmentStatusLabel(item.status)}</span></td><td><div className="admin-appointment-inline-actions">{item.status==="requested"?<><button disabled={saving===item.reference} onClick={()=>setStatus(item,"confirmed")}>Confirmer</button><button className="text-danger" disabled={saving===item.reference} onClick={()=>setStatus(item,"declined")}>Refuser</button></>:null}{item.status==="confirmed"?<><button disabled={saving===item.reference} onClick={()=>setStatus(item,"completed")}>Terminer</button><button className="text-danger" disabled={saving===item.reference} onClick={()=>setStatus(item,"cancelled")}>Annuler</button></>:null}</div></td></tr>)}</tbody></table>{!visible.length?<div className="dashboard-empty">Aucun rendez-vous.</div>:null}</div></section>
    </main>
  </div></div>;
}
