import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAdminUsers } from "../../api/admin.js";
import { getServices } from "../../api/services.js";
import {
  createAdminAppointment,
  createAdminAppointmentSlot,
  getAdminAppointments,
  getAdminAppointmentSlots,
  getAdminAppointmentSummary,
  getAppointmentStatusLabel,
  updateAdminAppointment,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const FILTERS=[["all","Tous"],["pending","En attente"],["confirmed","Confirmés"],["completed","Terminés"],["cancelled","Annulés"],["rejected","Refusés"],["no_show","Absents"]];
function todayKey(){return new Date().toISOString().slice(0,10)}

export default function AdminAppointments(){
  const [appointments,setAppointments]=useState([]);
  const [summary,setSummary]=useState({});
  const [users,setUsers]=useState([]);
  const [services,setServices]=useState([]);
  const [slots,setSlots]=useState([]);
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [serviceId,setServiceId]=useState("");
  const [date,setDate]=useState(todayKey());
  const [createForm,setCreateForm]=useState({citizen:"",slot:"",assignedTo:"",reason:""});
  const [slotForm,setSlotForm]=useState({startTime:"09:00",endTime:"09:30",capacity:1,agent:""});

  const citizens=useMemo(()=>users.filter(user=>user.role==="citizen"),[users]);
  const agents=useMemo(()=>users.filter(user=>user.role==="agent"),[users]);
  const visible=useMemo(()=>appointments.filter(item=>(filter==="all"||item.status===filter)&&(!query||`${item.reference} ${item.citizenName} ${item.citizenEmail} ${item.serviceName}`.toLowerCase().includes(query.toLowerCase()))),[appointments,filter,query]);

  async function loadCore(){
    const [rows,nextSummary]=await Promise.all([getAdminAppointments(),getAdminAppointmentSummary()]);
    setAppointments(rows);setSummary(nextSummary||{});
  }
  async function loadSlots(){
    if(!serviceId)return setSlots([]);
    const rows=await getAdminAppointmentSlots({service:serviceId,date});setSlots(rows);
  }

  useEffect(()=>{
    Promise.all([getAdminUsers(),getServices({publishedOnly:false}),getAdminAppointments(),getAdminAppointmentSummary()])
      .then(([userRows,serviceRows,appointmentRows,nextSummary])=>{
        setUsers(userRows);setServices(serviceRows);setAppointments(appointmentRows);setSummary(nextSummary||{});
        if(serviceRows[0])setServiceId(String(serviceRows[0].id));
      }).catch(err=>setError(getApiErrorMessage(err,"Impossible de charger les rendez-vous.")));
  },[]);
  useEffect(()=>{loadSlots().catch(err=>setError(getApiErrorMessage(err,"Impossible de charger les créneaux.")))},[serviceId,date]);

  async function createAppointment(event){
    event.preventDefault();setError("");
    try{
      await createAdminAppointment({citizen:createForm.citizen,service:serviceId,slot:createForm.slot,assigned_to:createForm.assignedTo||undefined,reason:createForm.reason});
      setNotice("Rendez-vous créé pour le citoyen.");setCreateForm({citizen:"",slot:"",assignedTo:"",reason:""});await Promise.all([loadCore(),loadSlots()]);
    }catch(err){setError(getApiErrorMessage(err,"Impossible de créer le rendez-vous."))}
  }

  async function createSlot(event){
    event.preventDefault();setError("");
    try{
      await createAdminAppointmentSlot({service:serviceId,agent:slotForm.agent||undefined,date,start_time:slotForm.startTime,end_time:slotForm.endTime,capacity:Number(slotForm.capacity)||1,is_active:true});
      setNotice("Créneau créé.");await loadSlots();
    }catch(err){setError(getApiErrorMessage(err,"Impossible de créer le créneau."))}
  }

  async function setStatus(item,status){
    try{await updateAdminAppointment(item.reference,{status});setNotice(`Rendez-vous ${getAppointmentStatusLabel(status).toLowerCase()}.`);await loadCore()}
    catch(err){setError(getApiErrorMessage(err,"Impossible de modifier le rendez-vous."))}
  }

  return <div className="portal-layout"><AdminSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Administration" title="Rendez-vous"/>
    <main className="portal-content admin-appointments-page">
      {notice?<div className="success-inline" role="status">{notice}</div>:null}{error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="metric-grid metric-grid--4"><article><span>Total</span><strong>{summary.total||appointments.length}</strong><small>{summary.today||0} aujourd’hui</small></article><article><span>En attente</span><strong>{summary.pending||0}</strong><small>À organiser</small></article><article><span>Confirmés</span><strong>{summary.confirmed||0}</strong><small>{summary.upcoming||0} à venir</small></article><article><span>Terminés</span><strong>{summary.completed||0}</strong><small>{summary.cancelled||0} annulés</small></article></section>

      <section className="portal-grid portal-grid--2 admin-appointment-tools">
        <article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Création administrative</span><h3>Créer un rendez-vous</h3></div></div><form className="admin-appointment-form" onSubmit={createAppointment}><label><span>Citoyen</span><select value={createForm.citizen} onChange={e=>setCreateForm({...createForm,citizen:e.target.value})} required><option value="">Sélectionner</option>{citizens.map(user=><option key={user.id} value={user.id}>{user.display_name||user.email}</option>)}</select></label><label><span>Service</span><select value={serviceId} onChange={e=>{setServiceId(e.target.value);setCreateForm({...createForm,slot:""})}} required>{services.map(service=><option value={service.id} key={service.id}>{service.name}</option>)}</select></label><label><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Créneau</span><select value={createForm.slot} onChange={e=>setCreateForm({...createForm,slot:e.target.value})} required><option value="">Sélectionner</option>{slots.filter(slot=>slot.isAvailable).map(slot=><option value={slot.id} key={slot.id}>{slot.startTime}–{slot.endTime} · {slot.remainingCapacity} place(s)</option>)}</select></label><label><span>Agent</span><select value={createForm.assignedTo} onChange={e=>setCreateForm({...createForm,assignedTo:e.target.value})}><option value="">Non assigné</option>{agents.map(user=><option key={user.id} value={user.id}>{user.display_name||user.email}</option>)}</select></label><label className="span-2"><span>Motif</span><input value={createForm.reason} onChange={e=>setCreateForm({...createForm,reason:e.target.value})} required/></label><button className="primary-action span-2" type="submit">Créer le rendez-vous</button></form></article>

        <article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Créneaux</span><h3>Ajouter une disponibilité</h3></div></div><form className="admin-appointment-form" onSubmit={createSlot}><label><span>Début</span><input type="time" value={slotForm.startTime} onChange={e=>setSlotForm({...slotForm,startTime:e.target.value})} required/></label><label><span>Fin</span><input type="time" value={slotForm.endTime} onChange={e=>setSlotForm({...slotForm,endTime:e.target.value})} required/></label><label><span>Capacité</span><input type="number" min="1" value={slotForm.capacity} onChange={e=>setSlotForm({...slotForm,capacity:e.target.value})}/></label><label><span>Agent</span><select value={slotForm.agent} onChange={e=>setSlotForm({...slotForm,agent:e.target.value})}><option value="">Tous / non assigné</option>{agents.map(user=><option key={user.id} value={user.id}>{user.display_name||user.email}</option>)}</select></label><button className="primary-action span-2" type="submit">+ Créer le créneau</button></form><div className="admin-slot-preview">{slots.slice(0,8).map(slot=><span key={slot.id} className={`slot-${slot.state}`}><b>{slot.startTime}</b><small>{slot.bookedCount}/{slot.capacity}</small></span>)}</div></article>
      </section>

      <section className="toolbar-card"><div className="toolbar-line"><label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, service..."/></label></div><div className="filter-row filter-row--portal">{FILTERS.map(([value,label])=><button key={value} type="button" className={filter===value?"is-active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div></section>
      <section className="portal-card"><div className="accessible-table-wrap"><table className="accessible-table"><caption className="sr-only">Tous les rendez-vous</caption><thead><tr><th>Référence</th><th>Citoyen</th><th>Service</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{visible.map(item=><tr key={item.reference}><td className="mono">{item.reference}</td><td><strong>{item.citizenName}</strong><small>{item.citizenEmail}</small></td><td>{item.serviceName}</td><td>{item.date} · {item.startTime}</td><td><span className={`status-pill status-${item.status}`}>{getAppointmentStatusLabel(item.status)}</span></td><td><div className="admin-appointment-inline-actions">{item.status==="pending"?<button onClick={()=>setStatus(item,"confirmed")}>Confirmer</button>:null}{item.status==="confirmed"?<button onClick={()=>setStatus(item,"completed")}>Terminer</button>:null}{["pending","confirmed"].includes(item.status)?<button className="text-danger" onClick={()=>setStatus(item,"cancelled")}>Annuler</button>:null}</div></td></tr>)}</tbody></table>{!visible.length?<div className="dashboard-empty">Aucun rendez-vous.</div>:null}</div></section>
    </main>
  </div></div>;
}
