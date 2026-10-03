import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import {
  getAppointments,
  getAppointmentSlots,
  getAppointmentStatusLabel,
  getSlotStatusLabel,
  getUpcomingDates,
  toggleAppointmentSlotAvailability,
  updateAppointment,
} from "../../api/appointments.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const FILTERS = [
  ["all","Tous"],
  ["confirmed","Confirmés"],
  ["checked_in","Arrivés / check-in"],
  ["completed","Terminés"],
  ["cancelled","Annulés"],
];

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short"}).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export default function AgentAppointments() {
  const [appointments,setAppointments]=useState([]);
  const [services,setServices]=useState([]);
  const [serviceId,setServiceId]=useState("");
  const [date,setDate]=useState("");
  const [filter,setFilter]=useState("all");
  const [notice,setNotice]=useState("");
  const dates=useMemo(()=>getUpcomingDates(8),[]);

  const selectedService=useMemo(
    ()=>services.find((item)=>String(item.id)===String(serviceId))||null,
    [services,serviceId]
  );

  const slots=useMemo(
    ()=>serviceId&&date?getAppointmentSlots({serviceId,date}):[],
    [serviceId,date,appointments]
  );

  const visible=useMemo(
    ()=>appointments.filter(item=>filter==="all"||item.status===filter),
    [appointments,filter]
  );

  const metrics=useMemo(()=>({
    confirmed:appointments.filter(item=>item.status==="confirmed").length,
    checked:appointments.filter(item=>item.status==="checked_in").length,
    completed:appointments.filter(item=>item.status==="completed").length,
    cancelled:appointments.filter(item=>item.status==="cancelled").length,
  }),[appointments]);

  function refresh(){
    setAppointments(getAppointments());
  }

  useEffect(()=>{
    getServices().then(rows=>{
      setServices(rows);
      if(rows[0])setServiceId(String(rows[0].id));
    }).catch(()=>setServices([]));
    refresh();
    const update=()=>refresh();
    window.addEventListener("nova-appointments-updated",update);
    return()=>window.removeEventListener("nova-appointments-updated",update);
  },[]);

  useEffect(()=>{
    if(!date&&dates[0])setDate(dates[0]);
  },[date,dates]);

  function setStatus(id,status){
    updateAppointment(id,{status});
    setNotice(`Rendez-vous ${getAppointmentStatusLabel(status).toLowerCase()}.`);
    refresh();
  }

  function toggleSlot(slot){
    if(slot.state==="booked")return;
    const makeUnavailable=slot.state==="available";
    toggleAppointmentSlotAvailability({
      serviceId,
      date,
      time:slot.time,
      unavailable:makeUnavailable,
    });
    setNotice(makeUnavailable?"Créneau marqué indisponible.":"Créneau rouvert.");
    refresh();
  }

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Organisation" title="Rendez-vous citoyens"/>
      <main className="portal-content appointment-agent-page">
        {notice?<div className="success-inline" role="status">{notice}</div>:null}

        <section className="metric-grid metric-grid--4 appointment-agent-metrics">
          <article><span>Confirmés</span><strong>{metrics.confirmed}</strong><small>À venir</small></article>
          <article><span>Arrivés</span><strong>{metrics.checked}</strong><small>Check-in effectué</small></article>
          <article><span>Terminés</span><strong>{metrics.completed}</strong><small>Rendez-vous clos</small></article>
          <article><span>Annulés</span><strong>{metrics.cancelled}</strong><small>Historique</small></article>
        </section>

        <section className="portal-grid portal-grid--2 appointment-agent-layout">
          <article className="portal-card appointment-slot-manager">
            <div className="portal-card__head">
              <div><span className="section-label">Disponibilités</span><h3>Créneaux du service</h3></div>
            </div>

            <div className="appointment-manager-controls">
              <label><span>Service</span><select value={serviceId} onChange={e=>setServiceId(e.target.value)}>
                {services.map(service=><option value={service.id} key={service.id}>{service.name}</option>)}
              </select></label>
              <label><span>Date</span><select value={date} onChange={e=>setDate(e.target.value)}>
                {dates.map(item=><option value={item} key={item}>{formatDate(item)} · {item}</option>)}
              </select></label>
            </div>

            <p className="detail-copy">Cliquez sur un créneau libre pour le rendre indisponible. Les créneaux déjà réservés ne peuvent pas être modifiés ici.</p>

            <div className="agent-slot-grid">
              {slots.map(slot=><button
                type="button"
                key={slot.key}
                className={`slot-${slot.state}`}
                onClick={()=>toggleSlot(slot)}
                disabled={slot.state==="booked"}
              >
                <b>{slot.time}</b>
                <span>{getSlotStatusLabel(slot.state)}</span>
                <i aria-hidden="true">{slot.state==="available"?"✓":slot.state==="booked"?"●":"×"}</i>
              </button>)}
            </div>

            <div className="appointment-slot-legend">
              <span><i className="is-available"/>Disponible</span>
              <span><i className="is-booked"/>Réservé</span>
              <span><i className="is-unavailable"/>Indisponible</span>
            </div>

            {selectedService?<div className="appointment-manager-service"><span>Service affiché</span><b>{selectedService.name}</b></div>:null}
          </article>

          <article className="portal-card appointment-agent-list">
            <div className="portal-card__head">
              <div><span className="section-label">Agenda</span><h3>Rendez-vous reçus</h3></div>
            </div>

            <div className="management-filter-row appointment-filter-row">
              {FILTERS.map(([value,label])=><button key={value} className={filter===value?"is-active":""} onClick={()=>setFilter(value)}>{label}</button>)}
            </div>

            <div className="agent-appointment-list">
              {visible.length?visible.map(item=><article key={item.id} className={`agent-appointment status-${item.status}`}>
                <div className="agent-appointment__time">
                  <b>{item.time}</b><span>{formatDate(item.date)}</span>
                </div>
                <div className="agent-appointment__body">
                  <div className="agent-appointment__title"><strong>{item.citizenName}</strong><em>{getAppointmentStatusLabel(item.status)}</em></div>
                  <span>{item.serviceName} · {item.id}</span>
                  <p>{item.reason||"Motif non précisé"}</p>
                  <div className="agent-appointment__meta">
                    <small>{item.citizenEmail||"—"}</small>
                    {item.reminder?<small>◌ rappel activé</small>:null}
                  </div>
                  <div className="agent-appointment__actions">
                    {item.status==="confirmed"?<button className="secondary-action" onClick={()=>setStatus(item.id,"checked_in")}>✓ Check-in</button>:null}
                    {item.status==="checked_in"?<button className="primary-action" onClick={()=>setStatus(item.id,"completed")}>Terminer</button>:null}
                    {["confirmed","checked_in"].includes(item.status)?<button className="text-danger" onClick={()=>setStatus(item.id,"cancelled")}>Annuler</button>:null}
                  </div>
                </div>
              </article>):<div className="dashboard-empty">Aucun rendez-vous dans ce filtre.</div>}
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>;
}
