import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getServices } from "../../api/services.js";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentSlots,
  getAppointmentStatusLabel,
  getCitizenAppointments,
} from "../../api/appointments.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY = {
  fr: {
    eyebrow:"Services citoyens", title:"Rendez-vous", hero:"Prendre rendez-vous avec un agent",
    intro:"Choisissez un service, une date et un créneau. Le résumé confirme clairement votre choix avant l’envoi.",
    service:"Service", reason:"Motif du rendez-vous", reasonPlaceholder:"Ex. Aide pour compléter une démarche",
    calendar:"Choisir une date", today:"Aujourd’hui", previous:"Mois précédent", next:"Mois suivant",
    weekdays:["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],
    available:"Disponible", selected:"Sélectionné", full:"Complet", unavailable:"Indisponible",
    slots:"Créneaux disponibles", noSlots:"Aucun créneau disponible pour cette date.",
    summary:"Votre rendez-vous", noSelection:"Choisissez une date et une heure pour compléter le résumé.",
    agent:"Agent", duration:"Durée", reminder:"Rappel avant le rendez-vous",
    reminderHelp:"Rappel local sur cet appareil lorsque vous revenez sur Nova Terra.",
    prepare:"À préparer", prepareText:"Présentez-vous environ 10 minutes avant, avec votre identifiant citoyen et les documents demandés par le service.",
    confirm:"Confirmer le rendez-vous", confirming:"Confirmation…", success:"Rendez-vous confirmé",
    successTitle:"Votre rendez-vous est bien confirmé", successMessage:"Le créneau est réservé. Vous pouvez quitter cette page ou prendre un autre rendez-vous.",
    leavePage:"Quitter la page", another:"Prendre un autre rendez-vous", reference:"Référence",
    myAppointments:"Mes prochains rendez-vous", empty:"Aucun rendez-vous programmé.", cancel:"Annuler",
    error:"Impossible d’enregistrer ce rendez-vous.", choose:"Sélectionnez un service, une date et un créneau.",
  },
  en: {
    eyebrow:"Citizen services", title:"Appointments", hero:"Book an appointment with an agent",
    intro:"Choose a service, date and time. The summary clearly confirms your selection before booking.",
    service:"Service", reason:"Reason for appointment", reasonPlaceholder:"E.g. Help completing a procedure",
    calendar:"Choose a date", today:"Today", previous:"Previous month", next:"Next month",
    weekdays:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    available:"Available", selected:"Selected", full:"Full", unavailable:"Unavailable",
    slots:"Available times", noSlots:"No available time for this date.",
    summary:"Your appointment", noSelection:"Choose a date and time to complete the summary.",
    agent:"Agent", duration:"Duration", reminder:"Appointment reminder",
    reminderHelp:"Local reminder on this device when you return to Nova Terra.",
    prepare:"What to prepare", prepareText:"Arrive about 10 minutes early with your citizen ID and the documents requested by the service.",
    confirm:"Confirm appointment", confirming:"Confirming…", success:"Appointment confirmed",
    successTitle:"Your appointment is confirmed", successMessage:"The time slot is booked. You can leave this page or book another appointment.",
    leavePage:"Leave this page", another:"Book another appointment", reference:"Reference",
    myAppointments:"My upcoming appointments", empty:"No appointment scheduled.", cancel:"Cancel",
    error:"Unable to save this appointment.", choose:"Select a service, date and time.",
  },
  mg: {
    eyebrow:"Sampan-draharaha", title:"Fotoana fihaonana", hero:"Haka fotoana hihaonana amin'ny agent",
    intro:"Safidio ny sampan-draharaha, daty ary ora. Haseho mazava ao amin'ny famintinana ny safidinao alohan'ny hanamafisana.",
    service:"Sampan-draharaha", reason:"Antony hihaonana", reasonPlaceholder:"Ohatra: Fanampiana amin'ny fangatahana",
    calendar:"Safidio ny daty", today:"Anio", previous:"Volana teo aloha", next:"Volana manaraka",
    weekdays:["Al","At","Ar","Ak","Z","As","Ad"],
    available:"Misy", selected:"Voafidy", full:"Feno", unavailable:"Tsy misy",
    slots:"Ora misy", noSlots:"Tsy misy ora malalaka amin'ity daty ity.",
    summary:"Ny fotoananao", noSelection:"Safidio ny daty sy ora mba hamenoana ny famintinana.",
    agent:"Agent", duration:"Faharetana", reminder:"Fampahatsiahivana",
    reminderHelp:"Fampahatsiahivana eo an-toerana amin'ity fitaovana ity rehefa miverina ao Nova Terra ianao.",
    prepare:"Zavatra omanina", prepareText:"Tongava eo ho eo 10 minitra mialoha miaraka amin'ny kara-panondro sy ny taratasy takian'ny sampan-draharaha.",
    confirm:"Hanamafy ny fotoana", confirming:"Manamafy…", success:"Voamarina ny fotoana",
    successTitle:"Voamarina tsara ny fotoana", successMessage:"Voatokana ny ora. Afaka miala amin'ity pejy ity ianao na maka fotoana hafa.",
    leavePage:"Hiala amin'ny pejy", another:"Haka fotoana hafa", reference:"Laharana",
    myAppointments:"Ny fotoana ho avy", empty:"Tsy misy fotoana voalahatra.", cancel:"Hanafoana",
    error:"Tsy afaka mitahiry ny fotoana.", choose:"Safidio ny sampan-draharaha, daty ary ora.",
  },
};

function pad(value){return String(value).padStart(2,"0")}

function dateKey(date){
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function parseDate(key){
  const [y,m,d]=String(key).split("-").map(Number);
  return new Date(y,m-1,d,12,0,0,0);
}

function startOfDay(date=new Date()){
  return new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0,0);
}

function sameMonth(a,b){
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth();
}

function buildMonthDays(monthDate){
  const first=new Date(monthDate.getFullYear(),monthDate.getMonth(),1,12);
  const mondayIndex=(first.getDay()+6)%7;
  const daysInMonth=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0).getDate();
  const cellCount=Math.ceil((mondayIndex+daysInMonth)/7)*7;
  const start=new Date(first);
  start.setDate(first.getDate()-mondayIndex);
  return Array.from({length:cellCount},(_,index)=>{
    const day=new Date(start);
    day.setDate(start.getDate()+index);
    return day;
  });
}

function monthLabel(date,locale){
  return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{
    month:"long",year:"numeric"
  }).format(date);
}

function longDate(date,locale){
  return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{
    weekday:"long",day:"2-digit",month:"long",year:"numeric"
  }).format(date);
}

function shortDate(date,locale){
  return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale==="mg"?"mg-MG":"fr-FR",{
    day:"2-digit",month:"short"
  }).format(date);
}

function statusForDay({day,serviceId,today}){
  const inPast=startOfDay(day)<today;
  const weekend=[0,6].includes(day.getDay());
  if(inPast||weekend)return "unavailable";
  if(!serviceId)return "available";
  const slots=getAppointmentSlots({serviceId,date:dateKey(day)});
  if(!slots.length)return "unavailable";
  if(slots.every(slot=>slot.state!=="available"))return "full";
  return "available";
}

export default function CitizenAppointments(){
  const {user}=useAuth();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const today=useMemo(()=>startOfDay(new Date()),[]);
  const [services,setServices]=useState([]);
  const [serviceId,setServiceId]=useState("");
  const [month,setMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1,12));
  const [date,setDate]=useState("");
  const [time,setTime]=useState("");
  const [reason,setReason]=useState("");
  const [reminder,setReminder]=useState(true);
  const [appointments,setAppointments]=useState([]);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [confirmedAppointment,setConfirmedAppointment]=useState(null);

  const selectedService=useMemo(
    ()=>services.find(item=>String(item.id)===String(serviceId))||null,
    [services,serviceId]
  );

  const monthDays=useMemo(()=>buildMonthDays(month),[month]);

  const slots=useMemo(
    ()=>serviceId&&date?getAppointmentSlots({serviceId,date}):[],
    [serviceId,date,appointments]
  );

  const selectedDate=date?parseDate(date):null;

  function refreshAppointments(){
    if(user?.id)setAppointments(getCitizenAppointments(user.id));
  }

  useEffect(()=>{
    getServices().then(rows=>{
      setServices(rows);
      if(rows[0])setServiceId(String(rows[0].id));
    }).catch(()=>setServices([]));
  },[locale]);

  useEffect(()=>{
    refreshAppointments();
    const refresh=()=>refreshAppointments();
    window.addEventListener("nova-appointments-updated",refresh);
    return()=>window.removeEventListener("nova-appointments-updated",refresh);
  },[user?.id]);

  useEffect(()=>{
    setTime("");
    if(date&&serviceId){
      const day=parseDate(date);
      const status=statusForDay({day,serviceId,today});
      if(status!=="available")setDate("");
    }
  },[serviceId]);

  useEffect(()=>setTime(""),[date]);

  function moveMonth(delta){
    setMonth(current=>new Date(current.getFullYear(),current.getMonth()+delta,1,12));
  }

  function selectDay(day){
    const state=statusForDay({day,serviceId,today});
    if(state!=="available")return;
    setDate(dateKey(day));
  }

  function onCalendarKey(event,day){
    const keys={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(!(event.key in keys))return;
    event.preventDefault();
    const next=new Date(day);
    next.setDate(day.getDate()+keys[event.key]);
    if(!sameMonth(next,month))setMonth(new Date(next.getFullYear(),next.getMonth(),1,12));
    window.requestAnimationFrame(()=>{
      const target=document.querySelector(`[data-calendar-date="${dateKey(next)}"]`);
      target?.focus();
    });
  }

  async function submit(event){
    event.preventDefault();
    setError("");setNotice("");
    if(!selectedService||!date||!time){
      setError(copy.choose);
      return;
    }
    setSaving(true);
    try{
      const created=createAppointment({
        citizenId:user?.id,
        citizenName:user?.display_name||`${user?.first_name||""} ${user?.last_name||""}`.trim()||user?.email,
        citizenEmail:user?.email||"",
        serviceId:selectedService.id,
        serviceName:selectedService.name,
        agentName:`Agent · ${selectedService.name}`,
        date,time,reason,reminder,
      });
      setNotice("");
      setConfirmedAppointment(created);
      refreshAppointments();
    }catch(err){
      setError(err?.message||copy.error);
    }finally{
      setSaving(false);
    }
  }

  function bookAnother(){
    setConfirmedAppointment(null);
    setNotice("");
    setError("");
    setReason("");
    setDate("");
    setTime("");
    setReminder(true);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function cancel(id){
    const ok=window.confirm(locale==="en"?"Cancel this appointment?":locale==="mg"?"Hanafoana ity fotoana ity?":"Annuler ce rendez-vous ?");
    if(!ok)return;
    cancelAppointment(id);
    refreshAppointments();
  }

  const availableSlots=slots.filter(slot=>slot.state==="available");

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
      <main className="portal-content appointment-redesign-page">
        <header className="appointment-redesign-header">
          <div>
            <span className="section-label">F39 · F40</span>
            <h2>{copy.hero}</h2>
            <p>{copy.intro}</p>
          </div>
          <div className="appointment-header-mark" aria-hidden="true">◷</div>
        </header>

        {notice?<div className="success-inline" role="status">{notice}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <form className="appointment-redesign-grid" onSubmit={submit}>
          <section className="portal-card appointment-main-card">
            <div className="appointment-service-row">
              <label className="appointment-modern-field">
                <span>{copy.service}</span>
                <select value={serviceId} onChange={event=>setServiceId(event.target.value)} required>
                  {services.map(service=><option value={service.id} key={service.id}>{service.name}</option>)}
                </select>
              </label>
              <label className="appointment-modern-field appointment-modern-field--reason">
                <span>{copy.reason}</span>
                <input value={reason} onChange={event=>setReason(event.target.value)} placeholder={copy.reasonPlaceholder} required/>
              </label>
            </div>

            <div className="appointment-calendar-section">
              <div className="appointment-section-heading">
                <div><span className="section-label">01</span><h3>{copy.calendar}</h3></div>
                <button type="button" className="appointment-today-button" onClick={()=>{
                  setMonth(new Date(today.getFullYear(),today.getMonth(),1,12));
                  if(statusForDay({day:today,serviceId,today})==="available")setDate(dateKey(today));
                }}>{copy.today}</button>
              </div>

              <div className="appointment-mini-calendar">
                <div className="appointment-calendar-toolbar">
                  <button type="button" aria-label={copy.previous} onClick={()=>moveMonth(-1)}>←</button>
                  <strong>{monthLabel(month,locale)}</strong>
                  <button type="button" aria-label={copy.next} onClick={()=>moveMonth(1)}>→</button>
                </div>

                <div className="appointment-calendar-weekdays" aria-hidden="true">
                  {copy.weekdays.map(day=><span key={day}>{day}</span>)}
                </div>

                <div className="appointment-calendar-grid" role="grid" aria-label={`${copy.calendar} · ${monthLabel(month,locale)}`}>
                  {monthDays.map(day=>{
                    const key=dateKey(day);
                    const inMonth=sameMonth(day,month);
                    const state=statusForDay({day,serviceId,today});
                    const isSelected=date===key;
                    const disabled=!inMonth||state!=="available";
                    const stateLabel=isSelected?copy.selected:state==="full"?copy.full:state==="unavailable"?copy.unavailable:copy.available;
                    return <button
                      type="button"
                      key={key}
                      data-calendar-date={key}
                      role="gridcell"
                      className={`appointment-calendar-day ${!inMonth?"is-outside":""} state-${state} ${isSelected?"is-selected":""}`}
                      disabled={disabled}
                      aria-disabled={disabled}
                      aria-selected={isSelected}
                      aria-label={`${longDate(day,locale)} · ${stateLabel}`}
                      onClick={()=>selectDay(day)}
                      onKeyDown={event=>onCalendarKey(event,day)}
                    >
                      <span>{day.getDate()}</span>
                      {inMonth?<i aria-hidden="true"/>:null}
                    </button>;
                  })}
                </div>

                <div className="appointment-calendar-legend" aria-label="Légende du calendrier">
                  <span><i className="state-available"/>{copy.available}</span>
                  <span><i className="state-selected"/>{copy.selected}</span>
                  <span><i className="state-full"/>{copy.full}</span>
                  <span><i className="state-unavailable"/>{copy.unavailable}</span>
                </div>
              </div>
            </div>

            <div className="appointment-time-section">
              <div className="appointment-section-heading">
                <div><span className="section-label">02</span><h3>{copy.slots}</h3></div>
                {selectedDate?<span className="appointment-selected-date">{longDate(selectedDate,locale)}</span>:null}
              </div>

              {!date?<div className="appointment-slots-empty">Sélectionnez d’abord une date dans le calendrier.</div>:
              availableSlots.length?<div className="appointment-time-grid" role="group" aria-label={copy.slots}>
                {slots.map(slot=><button
                  type="button"
                  key={slot.key}
                  disabled={slot.state!=="available"}
                  aria-pressed={time===slot.time}
                  className={`${slot.state!=="available"?"is-unavailable":""} ${time===slot.time?"is-selected":""}`}
                  onClick={()=>setTime(slot.time)}
                >
                  <b>{slot.time}</b>
                  <span>{slot.state==="available"?copy.available:slot.state==="booked"?copy.full:copy.unavailable}</span>
                </button>)}
              </div>:<div className="appointment-slots-empty">{copy.noSlots}</div>}
            </div>
          </section>

          <aside className="appointment-side-column">
            <section className="portal-card appointment-summary-card">
              <div className="appointment-summary-card__head">
                <div><span className="section-label">03</span><h3>{copy.summary}</h3></div>
                {date&&time?<i aria-hidden="true">✓</i>:null}
              </div>

              {!date||!time?<div className="appointment-summary-empty">
                <i aria-hidden="true">◷</i>
                <p>{copy.noSelection}</p>
              </div>:<div className="appointment-summary-modern">
                <div className="appointment-summary-date">
                  <strong>{selectedDate?selectedDate.getDate():""}</strong>
                  <span>{selectedDate?shortDate(selectedDate,locale):""}</span>
                  <b>{time}</b>
                </div>
                <div className="appointment-summary-facts">
                  <div><span>{copy.service}</span><b>{selectedService?.name||"—"}</b></div>
                  <div><span>{copy.agent}</span><b>{selectedService?`Agent · ${selectedService.name}`:"—"}</b></div>
                  <div><span>{copy.duration}</span><b>30 min</b></div>
                </div>
              </div>}

              <label className="appointment-reminder-modern">
                <input type="checkbox" checked={reminder} onChange={event=>setReminder(event.target.checked)}/>
                <div><b>{copy.reminder}</b><span>{copy.reminderHelp}</span></div>
              </label>

              <div className="appointment-prepare-modern">
                <span aria-hidden="true">✓</span>
                <div><b>{copy.prepare}</b><p>{copy.prepareText}</p>
                  {(selectedService?.requiredDocuments||[]).length?<ul>{selectedService.requiredDocuments.slice(0,3).map(item=><li key={item}>{item}</li>)}</ul>:null}
                </div>
              </div>

              <button className="primary-action appointment-confirm-modern" type="submit" disabled={saving||!date||!time}>
                {saving?copy.confirming:`${copy.confirm} →`}
              </button>
            </section>

            <section className="portal-card appointment-upcoming-card">
              <div className="portal-card__head"><div><span className="section-label">{copy.myAppointments}</span><h3>{copy.myAppointments}</h3></div></div>
              <div className="appointment-upcoming-list">
                {appointments.filter(item=>item.status!=="cancelled").slice(0,3).map(item=><article key={item.id}>
                  <div className="appointment-upcoming-date"><b>{parseDate(item.date).getDate()}</b><span>{shortDate(parseDate(item.date),locale).split(" ").slice(1).join(" ")}</span></div>
                  <div><strong>{item.serviceName}</strong><span>{item.time} · {getAppointmentStatusLabel(item.status)}</span><small>{item.reason}</small></div>
                  {item.status==="confirmed"?<button type="button" aria-label={copy.cancel} onClick={()=>cancel(item.id)}>×</button>:null}
                </article>)}
                {!appointments.filter(item=>item.status!=="cancelled").length?<div className="appointment-upcoming-empty"><i aria-hidden="true">◷</i><span>{copy.empty}</span></div>:null}
              </div>
            </section>
          </aside>
        </form>

        {confirmedAppointment?<div className="appointment-confirmation-backdrop" role="presentation">
          <section
            className="appointment-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-confirmation-title"
          >
            <div className="appointment-confirmation-check" aria-hidden="true">✓</div>
            <span className="section-label">{copy.success}</span>
            <h2 id="appointment-confirmation-title">{copy.successTitle}</h2>
            <p>{copy.successMessage}</p>

            <div className="appointment-confirmation-facts">
              <div><span>{copy.service}</span><b>{confirmedAppointment.serviceName}</b></div>
              <div><span>{copy.calendar}</span><b>{longDate(parseDate(confirmedAppointment.date),locale)}</b></div>
              <div><span>{copy.slots}</span><b>{confirmedAppointment.time}</b></div>
              <div><span>{copy.reference}</span><b>{confirmedAppointment.id}</b></div>
            </div>

            <div className="appointment-confirmation-actions">
              <button type="button" className="secondary-action" onClick={()=>navigate("/citizen")}>{copy.leavePage}</button>
              <button type="button" className="primary-action" onClick={bookAnother}>{copy.another}</button>
            </div>
          </section>
        </div>:null}
      </main>
    </div>
  </div>;
}
