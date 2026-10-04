import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getServices } from "../../api/services.js";
import {
  cancelCitizenAppointment,
  createCitizenAppointment,
  getAppointmentStatusLabel,
  getCitizenAppointmentAgents,
  getCitizenAppointmentAvailability,
  getCitizenAppointmentCollections,
  updateCitizenAppointment,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY = {
  fr: {
    eyebrow:"Services citoyens",title:"Rendez-vous",hero:"Prendre rendez-vous avec un agent",
    intro:"Choisissez un service, un agent, une date et une heure. Les créneaux déjà occupés sont vérifiés directement auprès du backend.",
    service:"Service",agent:"Agent",chooseAgent:"Sélectionner un agent",reason:"Motif du rendez-vous",reasonPlaceholder:"Ex. Aide pour compléter une démarche",
    calendar:"Choisir une date",today:"Aujourd’hui",previous:"Mois précédent",next:"Mois suivant",selectDateTitle:"Sélectionnez une date",selectDateHelp:"Choisissez un jour dans le calendrier pour vérifier les heures encore libres.",selectedDateTitle:"Date sélectionnée",availableSlotsCount:"créneaux disponibles",
    weekdays:["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],available:"Disponible",selected:"Sélectionné",full:"Occupé",unavailable:"Indisponible",
    slots:"Créneaux disponibles",noSlots:"Aucun créneau libre pour cette date.",selectDate:"Sélectionnez d’abord une date dans le calendrier.",loadingSlots:"Vérification des disponibilités…",
    summary:"Votre rendez-vous",noSelection:"Choisissez une date et une heure pour compléter le résumé.",duration:"Durée",
    reminder:"Rappel avant le rendez-vous",reminderHelp:"Recevoir un rappel 60 minutes avant le rendez-vous.",reminderOn:"Rappel activé",
    prepare:"À préparer",prepareText:"Présentez-vous environ 10 minutes avant, avec votre identifiant citoyen et les documents demandés par le service.",
    preferences:"Informations complémentaires",phone:"Téléphone de contact",language:"Langue préférée",accessibility:"Besoins d’accessibilité",notes:"Informations complémentaires",
    confirm:"Demander le rendez-vous",confirming:"Envoi…",createdConfirmed:"Votre rendez-vous est bien confirmé",createdPending:"Votre demande de rendez-vous est enregistrée",
    createdTextConfirmed:"Le rendez-vous est confirmé.",createdTextPending:"La demande a été envoyée. L’agent pourra la confirmer depuis son espace.",
    leavePage:"Quitter la page",another:"Prendre un autre rendez-vous",reference:"Référence",status:"Statut",
    upcoming:"Mes prochains rendez-vous",history:"Historique",empty:"Aucun rendez-vous programmé.",emptyHistory:"Aucun rendez-vous dans l’historique.",cancel:"Annuler",cancelAsk:"Annuler ce rendez-vous ?",cancelled:"Rendez-vous annulé.",
    error:"Impossible d’enregistrer ce rendez-vous.",availabilityError:"Impossible de vérifier les disponibilités de cet agent.",conflict:"Cette heure vient d’être réservée. Les disponibilités ont été actualisées.",choose:"Choisissez un service, un agent, une date et une heure.",
  },
  en: {
    eyebrow:"Citizen services",title:"Appointments",hero:"Book an appointment with an agent",intro:"Choose a service, an agent, a date and a time. Already-booked times are checked directly with the backend.",
    service:"Service",agent:"Agent",chooseAgent:"Select an agent",reason:"Reason for appointment",reasonPlaceholder:"E.g. Help completing a procedure",calendar:"Choose a date",today:"Today",previous:"Previous month",next:"Next month",selectDateTitle:"Select a date",selectDateHelp:"Choose a day to check the remaining free times.",selectedDateTitle:"Selected date",availableSlotsCount:"available time slots",
    weekdays:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],available:"Available",selected:"Selected",full:"Busy",unavailable:"Unavailable",slots:"Available times",noSlots:"No free time for this date.",selectDate:"Select a date in the calendar first.",loadingSlots:"Checking availability…",
    summary:"Your appointment",noSelection:"Choose a date and time to complete the summary.",duration:"Duration",reminder:"Appointment reminder",reminderHelp:"Receive a reminder 60 minutes before the appointment.",reminderOn:"Reminder enabled",prepare:"What to prepare",prepareText:"Arrive about 10 minutes early with your citizen ID and the documents requested by the service.",preferences:"Additional information",phone:"Contact phone",language:"Preferred language",accessibility:"Accessibility needs",notes:"Additional information",
    confirm:"Request appointment",confirming:"Sending…",createdConfirmed:"Your appointment is confirmed",createdPending:"Your appointment request is recorded",createdTextConfirmed:"The appointment is confirmed.",createdTextPending:"The request has been sent. The agent can confirm it from their workspace.",leavePage:"Leave this page",another:"Book another appointment",reference:"Reference",status:"Status",upcoming:"My upcoming appointments",history:"History",empty:"No appointment scheduled.",emptyHistory:"No appointment history.",cancel:"Cancel",cancelAsk:"Cancel this appointment?",cancelled:"Appointment cancelled.",error:"Unable to save this appointment.",availabilityError:"Unable to check this agent's availability.",conflict:"This time has just been booked. Availability has been refreshed.",choose:"Choose a service, agent, date and time.",
  },
  mg: {
    eyebrow:"Sampan-draharaha",title:"Fotoana fihaonana",hero:"Haka fotoana hihaonana amin'ny agent",intro:"Safidio ny sampan-draharaha, agent, daty ary ora. Hamarinina mivantana amin'ny backend ireo ora efa voafandrika.",
    service:"Sampan-draharaha",agent:"Agent",chooseAgent:"Safidio ny agent",reason:"Antony hihaonana",reasonPlaceholder:"Ohatra: Fanampiana amin'ny fangatahana",calendar:"Safidio ny daty",today:"Anio",previous:"Volana teo aloha",next:"Volana manaraka",selectDateTitle:"Safidio ny daty",selectDateHelp:"Safidio ny andro mba hahitana ireo ora mbola malalaka.",selectedDateTitle:"Daty voafidy",availableSlotsCount:"ora mbola misy",weekdays:["Al","At","Ar","Ak","Z","As","Ad"],available:"Misy",selected:"Voafidy",full:"Efa voafandrika",unavailable:"Tsy misy",slots:"Ora misy",noSlots:"Tsy misy ora malalaka amin'ity daty ity.",selectDate:"Safidio aloha ny daty.",loadingSlots:"Manamarina ny ora misy…",summary:"Ny fotoananao",noSelection:"Safidio ny daty sy ora.",duration:"Faharetana",reminder:"Fampahatsiahivana",reminderHelp:"Mahazoa fampahatsiahivana 60 minitra mialoha.",reminderOn:"Alefa ny fampahatsiahivana",prepare:"Zavatra omanina",prepareText:"Tongava eo ho eo 10 minitra mialoha miaraka amin'ny kara-panondro sy ny taratasy takiana.",preferences:"Fanazavana fanampiny",phone:"Telefaona",language:"Fiteny tiana",accessibility:"Filàna manokana",notes:"Fanazavana fanampiny",confirm:"Hangataka fotoana",confirming:"Mandefa…",createdConfirmed:"Voamarina ny fotoana",createdPending:"Voaray ny fangatahana fotoana",createdTextConfirmed:"Voamarina ny fotoana.",createdTextPending:"Nalefa ny fangatahana ary afaka manamarina azy ny agent.",leavePage:"Hiala amin'ny pejy",another:"Haka fotoana hafa",reference:"Laharana",status:"Sata",upcoming:"Ny fotoana ho avy",history:"Tantara",empty:"Tsy misy fotoana voalahatra.",emptyHistory:"Tsy misy tantara.",cancel:"Hanafoana",cancelAsk:"Hanafoana ity fotoana ity?",cancelled:"Nofoanana ny fotoana.",error:"Tsy afaka mitahiry ny fotoana.",availabilityError:"Tsy afaka manamarina ny ora misy.",conflict:"Efa voafandrika io ora io. Nohavaozina ny ora misy.",choose:"Safidio ny sampan-draharaha, agent, daty ary ora.",
  },
};

function pad(value){return String(value).padStart(2,"0")}
function dateKey(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function parseDate(key){const [y,m,d]=String(key).split("-").map(Number);return new Date(y,m-1,d,12,0,0,0)}
function startOfDay(date=new Date()){return new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0,0)}
function sameMonth(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()}
function buildMonthDays(monthDate){const first=new Date(monthDate.getFullYear(),monthDate.getMonth(),1,12);const mondayIndex=(first.getDay()+6)%7;const daysInMonth=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0).getDate();const cellCount=Math.ceil((mondayIndex+daysInMonth)/7)*7;const start=new Date(first);start.setDate(first.getDate()-mondayIndex);return Array.from({length:cellCount},(_,index)=>{const day=new Date(start);day.setDate(start.getDate()+index);return day})}
function monthLabel(date,locale){return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{month:"long",year:"numeric"}).format(date)}
function longDate(date,locale){return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(date)}
function shortDate(date,locale){return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{day:"2-digit",month:"short"}).format(date)}

export default function CitizenAppointments(){
  const {user}=useAuth();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const today=useMemo(()=>startOfDay(new Date()),[]);
  const [services,setServices]=useState([]);
  const [agents,setAgents]=useState([]);
  const [serviceId,setServiceId]=useState("");
  const [agentId,setAgentId]=useState("");
  const [month,setMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1,12));
  const [date,setDate]=useState("");
  const [availability,setAvailability]=useState([]);
  const [availabilityLoading,setAvailabilityLoading]=useState(false);
  const [slotId,setSlotId]=useState("");
  const [reason,setReason]=useState("");
  const [notes,setNotes]=useState("");
  const [contactPhone,setContactPhone]=useState(user?.phone_number||"");
  const [accessibilityNeeds,setAccessibilityNeeds]=useState("");
  const [preferredLanguage,setPreferredLanguage]=useState(locale);
  const [reminderEnabled,setReminderEnabled]=useState(true);
  const [reminderMinutes,setReminderMinutes]=useState(60);
  const [upcoming,setUpcoming]=useState([]);
  const [history,setHistory]=useState([]);
  const [listMode,setListMode]=useState("upcoming");
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [confirmedAppointment,setConfirmedAppointment]=useState(null);

  const selectedService=useMemo(()=>services.find(item=>String(item.id)===String(serviceId))||null,[services,serviceId]);
  const selectedAgent=useMemo(()=>agents.find(item=>String(item.id)===String(agentId))||null,[agents,agentId]);
  const monthDays=useMemo(()=>buildMonthDays(month),[month]);
  const selectedSlot=availability.find(slot=>String(slot.id)===String(slotId))||null;
  const selectedDate=date?parseDate(date):null;
  const selectedDayAvailableCount=availability.filter(slot=>slot.isAvailable).length;

  async function loadLists(){
    try{
      const collections=await getCitizenAppointmentCollections();
      setUpcoming(collections.upcoming);setHistory(collections.history);
    }catch(err){setError(getApiErrorMessage(err,copy.error))}
  }

  async function loadAvailability(nextAgent=agentId,nextDate=date){
    if(!nextAgent||!nextDate){setAvailability([]);return}
    setAvailabilityLoading(true);setError("");
    try{
      const agent=agents.find(item=>String(item.id)===String(nextAgent));
      const service=services.find(item=>String(item.id)===String(serviceId));
      const rows=await getCitizenAppointmentAvailability({agent:nextAgent,date:nextDate,agentName:agent?.name||"",openingHours:service?.openingHours||""});
      setAvailability(rows);
    }catch(err){setAvailability([]);setError(getApiErrorMessage(err,copy.availabilityError))}
    finally{setAvailabilityLoading(false)}
  }

  useEffect(()=>{
    let mounted=true;
    Promise.all([getServices(),getCitizenAppointmentAgents()]).then(([serviceRows,agentRows])=>{
      if(!mounted)return;
      const bookableServices=serviceRows.filter(service=>service.isAvailable!==false);
      setServices(bookableServices);setAgents(agentRows);
      if(bookableServices[0])setServiceId(String(bookableServices[0].id));
      if(agentRows[0])setAgentId(String(agentRows[0].id));
    }).catch(err=>mounted&&setError(getApiErrorMessage(err,copy.error)));
    loadLists();
    return()=>{mounted=false};
  },[locale]);

  useEffect(()=>{setContactPhone(user?.phone_number||"")},[user?.phone_number]);
  useEffect(()=>{setPreferredLanguage(locale)},[locale]);
  useEffect(()=>{setSlotId("");if(agentId&&date)loadAvailability(agentId,date);else setAvailability([])},[agentId,date,serviceId]);

  function dayState(day){
    if(startOfDay(day)<today||!sameMonth(day,month))return "unavailable";
    if(date===dateKey(day)&&!availabilityLoading&&availability.length&&!availability.some(slot=>slot.isAvailable))return "full";
    return "available";
  }
  function moveMonth(delta){setMonth(current=>new Date(current.getFullYear(),current.getMonth()+delta,1,12))}
  function selectDay(day){if(dayState(day)==="unavailable")return;setDate(dateKey(day))}
  function onCalendarKey(event,day){const keys={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(event.key in keys))return;event.preventDefault();const next=new Date(day);next.setDate(day.getDate()+keys[event.key]);if(!sameMonth(next,month))setMonth(new Date(next.getFullYear(),next.getMonth(),1,12));window.requestAnimationFrame(()=>document.querySelector(`[data-calendar-date="${dateKey(next)}"]`)?.focus())}

  function bookAnother(){setConfirmedAppointment(null);setNotice("");setError("");setReason("");setNotes("");setDate("");setSlotId("");setAvailability([]);setReminderEnabled(true);setReminderMinutes(60);window.scrollTo({top:0,behavior:"smooth"})}

  async function submit(event){
    event.preventDefault();setError("");setNotice("");
    if(!selectedService||!selectedAgent||!date||!selectedSlot||!selectedSlot.isAvailable){setError(copy.choose);return}
    setSaving(true);
    try{
      const details=[notes.trim(),accessibilityNeeds.trim()?`Accessibilité: ${accessibilityNeeds.trim()}`:"",contactPhone.trim()?`Téléphone: ${contactPhone.trim()}`:"",preferredLanguage?`Langue: ${preferredLanguage}`:""].filter(Boolean).join("\n");
      const created=await createCitizenAppointment({
        agent:selectedAgent.id,service:selectedService.id,starts_at:selectedSlot.startsAt,ends_at:selectedSlot.endsAt,
        reason:reason.trim(),details,reminder_enabled:reminderEnabled,reminder_minutes_before:reminderMinutes,
      });
      setConfirmedAppointment(created);await Promise.all([loadLists(),loadAvailability(agentId,date)]);
    }catch(err){
      if([400,409].includes(err?.response?.status)){setError(getApiErrorMessage(err,copy.conflict));setSlotId("");await loadAvailability(agentId,date)}
      else setError(getApiErrorMessage(err,copy.error));
    }finally{setSaving(false)}
  }

  async function cancel(item){
    if(!window.confirm(copy.cancelAsk))return;
    try{await cancelCitizenAppointment(item.reference);setNotice(copy.cancelled);await loadLists()}
    catch(err){setError(getApiErrorMessage(err,copy.error))}
  }

  async function toggleReminder(item){
    try{
      const nextEnabled=!item.reminderEnabled;
      await updateCitizenAppointment(item.reference,{reminder_enabled:nextEnabled,reminder_minutes_before:item.reminderMinutesBefore||60});
      setNotice(nextEnabled?"Rappel activé.":"Rappel désactivé.");
      await loadLists();
    }catch(err){setError(getApiErrorMessage(err,copy.error))}
  }

  const shownList=listMode==="upcoming"?upcoming:history;
  const isConfirmed=confirmedAppointment?.status==="confirmed";

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content appointment-redesign-page">
      <header className="appointment-redesign-header"><div><span className="section-label">F39 · F40</span><h2>{copy.hero}</h2><p>{copy.intro}</p></div><div className="appointment-header-mark" aria-hidden="true"><span>▦</span><i>◷</i></div></header>
      {notice?<div className="success-inline" role="status">{notice}</div>:null}
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {!services.length?<div className="error-card" role="status">Aucun service actuellement disponible ne peut recevoir de rendez-vous. Consultez la page Services pour voir les alternatives ou la date de rétablissement.</div>:null}

      <form className="appointment-redesign-grid" onSubmit={submit}>
        <section className="portal-card appointment-main-card">
          <div className="appointment-service-row">
            <label className="appointment-modern-field"><span>{copy.service}</span><select value={serviceId} onChange={e=>setServiceId(e.target.value)} required><option value="">—</option>{services.map(service=><option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
            <label className="appointment-modern-field"><span>{copy.agent}</span><select value={agentId} onChange={e=>setAgentId(e.target.value)} required><option value="">{copy.chooseAgent}</option>{agents.map(agent=><option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></label>
            <label className="appointment-modern-field appointment-modern-field--reason"><span>{copy.reason}</span><input value={reason} onChange={e=>setReason(e.target.value)} placeholder={copy.reasonPlaceholder} required/></label>
          </div>

          <div className="appointment-calendar-section">
            <div className="appointment-section-heading"><div><span className="section-label">01</span><h3>{copy.calendar}</h3></div><button type="button" className="appointment-today-button" onClick={()=>setMonth(new Date(today.getFullYear(),today.getMonth(),1,12))}>{copy.today}</button></div>
            <div className="appointment-date-picker-layout">
              <aside className={`appointment-date-guide ${selectedDate?"has-selection":""}`} aria-live="polite"><div className="appointment-date-guide__visual" aria-hidden="true"><span>▦</span><i/></div><div><strong>{selectedDate?copy.selectedDateTitle:copy.selectDateTitle}</strong>{selectedDate?<><p>{longDate(selectedDate,locale)}</p><span className="appointment-date-guide__count">{selectedDayAvailableCount} {copy.availableSlotsCount}</span></>:<p>{copy.selectDateHelp}</p>}</div></aside>
              <div className={`appointment-mini-calendar ${availabilityLoading?"is-loading":""}`}>
                <div className="appointment-calendar-toolbar"><button type="button" aria-label={copy.previous} onClick={()=>moveMonth(-1)}>←</button><strong>{monthLabel(month,locale)}</strong><button type="button" aria-label={copy.next} onClick={()=>moveMonth(1)}>→</button></div>
                <div className="appointment-calendar-weekdays" aria-hidden="true">{copy.weekdays.map(day=><span key={day}>{day}</span>)}</div>
                <div className="appointment-calendar-grid" role="grid" aria-label={`${copy.calendar} · ${monthLabel(month,locale)}`}>
                  {monthDays.map(day=>{const key=dateKey(day);const inMonth=sameMonth(day,month);const state=dayState(day);const isSelected=date===key;const disabled=!inMonth||state==="unavailable";const stateLabel=isSelected?copy.selected:state==="full"?copy.full:state==="unavailable"?copy.unavailable:copy.available;return <button type="button" key={key} data-calendar-date={key} role="gridcell" disabled={disabled} aria-pressed={isSelected} aria-label={`${longDate(day,locale)} · ${stateLabel}`} className={`appointment-calendar-day state-${state} ${isSelected?"is-selected":""} ${!inMonth?"is-outside":""}`} onClick={()=>selectDay(day)} onKeyDown={event=>onCalendarKey(event,day)}><span>{day.getDate()}</span><small>{stateLabel}</small></button>})}
                </div>
                <div className="appointment-calendar-legend"><span><i className="state-available"/>{copy.available}</span><span><i className="state-selected"/>{copy.selected}</span><span><i className="state-full"/>{copy.full}</span><span><i className="state-unavailable"/>{copy.unavailable}</span></div>
              </div>
            </div>
          </div>

          <div className="appointment-time-section">
            <div className="appointment-section-heading"><div><span className="section-label">02</span><h3>{copy.slots}</h3></div>{selectedDate?<span className="appointment-selected-date">{longDate(selectedDate,locale)}</span>:null}</div>
            {!date?<div className="appointment-slots-empty">{copy.selectDate}</div>:availabilityLoading?<div className="appointment-slots-empty">{copy.loadingSlots}</div>:availability.length?<div className="appointment-time-grid" role="group" aria-label={copy.slots}>{availability.map(slot=>{const selected=String(slotId)===String(slot.id);const slotState=slot.isAvailable?"available":"full";return <button type="button" key={slot.id} disabled={!slot.isAvailable} aria-pressed={selected} className={`state-${slotState} ${selected?"is-selected":""}`} onClick={()=>setSlotId(String(slot.id))}><b>{slot.startTime}</b><span>{slot.isAvailable?copy.available:copy.full}</span></button>})}</div>:<div className="appointment-slots-empty">{copy.noSlots}</div>}
          </div>
        </section>

        <aside className="appointment-side-column">
          <section className="portal-card appointment-summary-card">
            <div className="appointment-summary-card__head"><div><span className="section-label">03</span><h3>{copy.summary}</h3></div>{date&&selectedSlot?<i aria-hidden="true">✓</i>:null}</div>
            {!date||!selectedSlot?<div className="appointment-summary-empty"><i aria-hidden="true">◷</i><p>{copy.noSelection}</p></div>:<div className="appointment-summary-modern"><div className="appointment-summary-date"><strong>{selectedDate?.getDate()}</strong><span>{shortDate(selectedDate,locale)}</span><b>{selectedSlot.startTime}</b></div><div className="appointment-summary-facts"><div><span>{copy.service}</span><b>{selectedService?.name||"—"}</b></div><div><span>{copy.agent}</span><b>{selectedAgent?.name||"—"}</b></div><div><span>{copy.duration}</span><b>{selectedSlot.startTime}–{selectedSlot.endTime}</b></div></div></div>}
            <details className="appointment-preferences-details"><summary>{copy.preferences}</summary><div className="appointment-preferences-grid"><label><span>{copy.phone}</span><input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="+261..."/></label><label><span>{copy.language}</span><select value={preferredLanguage} onChange={e=>setPreferredLanguage(e.target.value)}><option value="fr">Français</option><option value="en">English</option><option value="mg">Malagasy</option></select></label><label className="span-2"><span>{copy.accessibility}</span><input value={accessibilityNeeds} onChange={e=>setAccessibilityNeeds(e.target.value)} placeholder="Ex. accès sans escalier, accompagnement..."/></label><label className="span-2"><span>{copy.notes}</span><textarea rows="2" value={notes} onChange={e=>setNotes(e.target.value)}/></label></div></details>
            <div className="appointment-reminder-modern appointment-reminder-settings"><label className="appointment-reminder-toggle"><span className="appointment-reminder-icon" aria-hidden="true">◌</span><div><b>{copy.reminder}</b><span>{copy.reminderHelp}</span></div><input type="checkbox" checked={reminderEnabled} onChange={e=>setReminderEnabled(e.target.checked)} aria-label={copy.reminderOn}/><i aria-hidden="true"/></label>{reminderEnabled?<label className="appointment-reminder-delay"><span>Délai</span><select value={reminderMinutes} onChange={e=>setReminderMinutes(Number(e.target.value))}><option value={30}>30 min avant</option><option value={60}>1 h avant</option><option value={120}>2 h avant</option></select></label>:null}</div>
            <div className="appointment-prepare-modern"><span aria-hidden="true">✓</span><div><b>{copy.prepare}</b><p>{copy.prepareText}</p>{(selectedService?.requiredDocuments||[]).length?<ul>{selectedService.requiredDocuments.slice(0,3).map(item=><li key={item}>{item}</li>)}</ul>:null}</div></div>
            <button className="primary-action appointment-confirm-modern" type="submit" disabled={saving||!selectedService||!selectedAgent||!date||!selectedSlot||!reason.trim()}>{saving?copy.confirming:`${copy.confirm} →`}</button>
          </section>

          <section className="portal-card appointment-upcoming-card">
            <div className="appointment-list-tabs"><button type="button" className={listMode==="upcoming"?"is-active":""} onClick={()=>setListMode("upcoming")}>{copy.upcoming}</button><button type="button" className={listMode==="history"?"is-active":""} onClick={()=>setListMode("history")}>{copy.history}</button></div>
            <div className="appointment-upcoming-list">{shownList.slice(0,4).map(item=><article key={item.reference}><div className="appointment-upcoming-date"><b>{item.date?parseDate(item.date).getDate():"—"}</b><span>{item.date?shortDate(parseDate(item.date),locale).split(" ").slice(1).join(" "):""}</span></div><div><strong>{item.serviceName}</strong><span>{item.startTime} · {getAppointmentStatusLabel(item.status)}</span><small>{item.reason}</small>{listMode==="upcoming"?<small>{item.reminderEnabled?`Rappel ${item.reminderMinutesBefore||60} min avant`:"Rappel désactivé"}</small>:null}</div><div className="appointment-upcoming-actions"><button type="button" title="Voir le rendez-vous" onClick={()=>navigate(`/citizen/appointments/${encodeURIComponent(item.reference)}`)}>→</button>{listMode==="upcoming"?<button type="button" title={item.reminderEnabled?"Désactiver le rappel":"Activer le rappel"} onClick={()=>toggleReminder(item)}>◌</button>:null}{listMode==="upcoming"&&item.canCancel?<button type="button" title={copy.cancel} onClick={()=>cancel(item)}>×</button>:null}</div></article>)}{!shownList.length?<div className="appointment-upcoming-empty"><i aria-hidden="true">◷</i><span>{listMode==="upcoming"?copy.empty:copy.emptyHistory}</span></div>:null}</div>
          </section>
        </aside>
      </form>

      {confirmedAppointment?<div className="appointment-confirmation-backdrop" role="presentation"><section className="appointment-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-confirmation-title"><div className="appointment-confirmation-check" aria-hidden="true">✓</div><span className="section-label">{getAppointmentStatusLabel(confirmedAppointment.status)}</span><h2 id="appointment-confirmation-title">{isConfirmed?copy.createdConfirmed:copy.createdPending}</h2><p>{isConfirmed?copy.createdTextConfirmed:copy.createdTextPending}</p><div className="appointment-confirmation-facts"><div><span>{copy.service}</span><b>{confirmedAppointment.serviceName}</b></div><div><span>{copy.agent}</span><b>{confirmedAppointment.agentName}</b></div><div><span>{copy.calendar}</span><b>{confirmedAppointment.date?longDate(parseDate(confirmedAppointment.date),locale):"—"}</b></div><div><span>{copy.slots}</span><b>{confirmedAppointment.startTime}</b></div><div><span>{copy.reference}</span><b>{confirmedAppointment.reference}</b></div><div><span>{copy.status}</span><b>{getAppointmentStatusLabel(confirmedAppointment.status)}</b></div></div><div className="appointment-confirmation-actions"><button type="button" className="secondary-action" onClick={()=>navigate("/citizen")}>{copy.leavePage}</button><button type="button" className="secondary-action" onClick={()=>navigate(`/citizen/appointments/${encodeURIComponent(confirmedAppointment.reference)}`)}>Voir le rendez-vous</button><button type="button" className="primary-action" onClick={bookAnother}>{copy.another}</button></div></section></div>:null}
    </main>
  </div></div>;
}
