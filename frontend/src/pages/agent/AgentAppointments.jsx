import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import {
  createAgentAppointmentSlot,
  disableAgentAppointmentSlot,
  getAgentAppointmentSlots,
  getAgentAppointments,
  getAgentAppointmentSummary,
  getAppointmentStatusLabel,
  getSlotStatusLabel,
  updateAgentAppointment,
  updateAgentAppointmentSlot,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const FILTERS = [
  ["all","Tous"],["pending","En attente"],["confirmed","Confirmés"],["completed","Terminés"],["cancelled","Annulés"],["rejected","Refusés"],["no_show","Absents"],
];

function formatDate(date) {
  try {return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short"}).format(new Date(`${date}T12:00:00`))}
  catch{return date}
}
function todayKey(){return new Date().toISOString().slice(0,10)}

export default function AgentAppointments() {
  const [appointments,setAppointments]=useState([]);
  const [summary,setSummary]=useState({});
  const [services,setServices]=useState([]);
  const [slots,setSlots]=useState([]);
  const [serviceId,setServiceId]=useState("");
  const [date,setDate]=useState(todayKey());
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [slotForm,setSlotForm]=useState({startTime:"09:00",endTime:"09:30",capacity:1});

  const visible=useMemo(()=>appointments.filter(item=>
    (filter==="all"||item.status===filter) &&
    (!query||`${item.reference} ${item.citizenName} ${item.citizenEmail} ${item.serviceName} ${item.reason}`.toLowerCase().includes(query.toLowerCase()))
  ),[appointments,filter,query]);

  async function loadAppointments(){
    const [rows,nextSummary]=await Promise.all([getAgentAppointments(),getAgentAppointmentSummary()]);
    setAppointments(rows);setSummary(nextSummary||{});
  }
  async function loadSlots(nextService=serviceId,nextDate=date){
    if(!nextService)return setSlots([]);
    const rows=await getAgentAppointmentSlots({service:nextService,date:nextDate});
    setSlots(rows);
  }
  async function refresh(){
    setError("");
    try{await Promise.all([loadAppointments(),loadSlots()])}
    catch(err){setError(getApiErrorMessage(err,"Impossible de charger les rendez-vous."))}
  }

  useEffect(()=>{
    let mounted=true;
    Promise.all([getServices(),getAgentAppointments(),getAgentAppointmentSummary()])
      .then(([serviceRows,appointmentRows,nextSummary])=>{
        if(!mounted)return;
        setServices(serviceRows);setAppointments(appointmentRows);setSummary(nextSummary||{});
        if(serviceRows[0])setServiceId(String(serviceRows[0].id));
      })
      .catch(err=>mounted&&setError(getApiErrorMessage(err,"Impossible de charger les rendez-vous.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[]);

  useEffect(()=>{if(serviceId)loadSlots(serviceId,date).catch(err=>setError(getApiErrorMessage(err,"Impossible de charger les créneaux.")))},[serviceId,date]);

  async function setStatus(item,status){
    setError("");
    try{
      const cancellationReason=["cancelled","rejected"].includes(status)?window.prompt("Motif (facultatif)","")||"":"";
      await updateAgentAppointment(item.reference,{status,cancellation_reason:cancellationReason});
      setNotice(`Rendez-vous ${getAppointmentStatusLabel(status).toLowerCase()}.`);
      await loadAppointments();
    }catch(err){setError(getApiErrorMessage(err,"Impossible de mettre à jour le rendez-vous."))}
  }

  async function createSlot(event){
    event.preventDefault();setError("");
    try{
      await createAgentAppointmentSlot({service:serviceId,date,start_time:slotForm.startTime,end_time:slotForm.endTime,capacity:Number(slotForm.capacity)||1});
      setNotice("Créneau créé.");await loadSlots();
    }catch(err){setError(getApiErrorMessage(err,"Impossible de créer le créneau."))}
  }

  async function toggleSlot(slot){
    setError("");
    try{
      if(slot.isActive)await disableAgentAppointmentSlot(slot.id);
      else await updateAgentAppointmentSlot(slot.id,{is_active:true});
      setNotice(slot.isActive?"Créneau désactivé.":"Créneau réactivé.");
      await loadSlots();
    }catch(err){setError(getApiErrorMessage(err,"Impossible de modifier le créneau."))}
  }

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Organisation" title="Rendez-vous citoyens"/>
    <main className="portal-content appointment-agent-page">
      {loading?<div className="loading-card">Chargement…</div>:null}
      {notice?<div className="success-inline" role="status">{notice}</div>:null}
      {error?<div className="error-card" role="alert">{error}</div>:null}

      <section className="metric-grid metric-grid--4 appointment-agent-metrics">
        <article><span>Aujourd’hui</span><strong>{summary.today||0}</strong><small>Rendez-vous du jour</small></article>
        <article><span>En attente</span><strong>{summary.pending||0}</strong><small>À confirmer</small></article>
        <article><span>Confirmés</span><strong>{summary.confirmed||0}</strong><small>{summary.upcoming||0} à venir</small></article>
        <article><span>Terminés</span><strong>{summary.completed||0}</strong><small>{summary.no_show||0} absents</small></article>
      </section>

      <section className="portal-grid portal-grid--2 appointment-agent-layout">
        <article className="portal-card appointment-slot-manager">
          <div className="portal-card__head"><div><span className="section-label">Disponibilités</span><h3>Créneaux du service</h3></div></div>
          <div className="appointment-manager-controls">
            <label><span>Service</span><select value={serviceId} onChange={e=>setServiceId(e.target.value)}>{services.map(service=><option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
            <label><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
          </div>

          <form className="agent-slot-create-form" onSubmit={createSlot}>
            <label><span>Début</span><input type="time" value={slotForm.startTime} onChange={e=>setSlotForm({...slotForm,startTime:e.target.value})} required/></label>
            <label><span>Fin</span><input type="time" value={slotForm.endTime} onChange={e=>setSlotForm({...slotForm,endTime:e.target.value})} required/></label>
            <label><span>Capacité</span><input type="number" min="1" max="20" value={slotForm.capacity} onChange={e=>setSlotForm({...slotForm,capacity:e.target.value})}/></label>
            <button className="primary-action" type="submit">+ Créer le créneau</button>
          </form>

          <div className="agent-slot-grid agent-slot-grid--backend">
            {slots.map(slot=><button type="button" key={slot.id} className={`slot-${slot.state}`} onClick={()=>toggleSlot(slot)}>
              <b>{slot.startTime}</b><span>{slot.endTime} · {getSlotStatusLabel(slot.state)}</span><small>{slot.bookedCount}/{slot.capacity} réservés</small><i aria-hidden="true">{slot.isActive?"✓":"×"}</i>
            </button>)}
            {!slots.length?<div className="dashboard-empty">Aucun créneau pour cette date.</div>:null}
          </div>
          <div className="appointment-slot-legend"><span><i className="is-available"/>Disponible</span><span><i className="is-booked"/>Complet</span><span><i className="is-unavailable"/>Inactif</span></div>
        </article>

        <article className="portal-card appointment-agent-list">
          <div className="portal-card__head"><div><span className="section-label">Agenda backend</span><h3>Rendez-vous reçus</h3></div></div>
          <label className="portal-search appointment-agent-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, service..."/></label>
          <div className="management-filter-row appointment-filter-row">{FILTERS.map(([value,label])=><button type="button" key={value} className={filter===value?"is-active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div>
          <div className="agent-appointment-list">
            {visible.length?visible.map(item=><article key={item.reference} className={`agent-appointment status-${item.status}`}>
              <div className="agent-appointment__time"><b>{item.startTime}</b><span>{formatDate(item.date)}</span></div>
              <div className="agent-appointment__body">
                <div className="agent-appointment__title"><strong>{item.citizenName}</strong><em>{getAppointmentStatusLabel(item.status)}</em></div>
                <span>{item.serviceName} · {item.reference}</span><p>{item.reason||"Motif non précisé"}</p>
                <div className="agent-appointment__meta"><small>{item.citizenEmail||"—"}</small>{item.citizenPhone?<small>{item.citizenPhone}</small>:null}</div>
                <div className="agent-appointment__actions">
                  {item.status==="pending"?<><button className="primary-action" type="button" onClick={()=>setStatus(item,"confirmed")}>Confirmer</button><button className="text-danger" type="button" onClick={()=>setStatus(item,"rejected")}>Refuser</button></>:null}
                  {item.status==="confirmed"?<><button className="primary-action" type="button" onClick={()=>setStatus(item,"completed")}>Terminer</button><button className="secondary-action" type="button" onClick={()=>setStatus(item,"no_show")}>Absent</button><button className="text-danger" type="button" onClick={()=>setStatus(item,"cancelled")}>Annuler</button></>:null}
                </div>
              </div>
            </article>):<div className="dashboard-empty">Aucun rendez-vous dans ce filtre.</div>}
          </div>
        </article>
      </section>
    </main>
  </div></div>;
}
