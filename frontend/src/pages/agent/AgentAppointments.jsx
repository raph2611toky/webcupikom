import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import PortalActionDialog from "../../components/ui/PortalActionDialog.jsx";
import { getAgentAppointments, getAgentAppointmentSummary, getAppointmentStatusLabel, updateAgentAppointment } from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

const FILTERS=[["","Tous"],["requested","À confirmer"],["confirmed","Confirmés"],["completed","Terminés"],["cancelled","Annulés"],["declined","Refusés"]];
function formatDate(date){if(!date)return"—";try{return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${date}T12:00:00`))}catch{return date}}

function toLocalInput(value){const date=new Date(value||"");if(Number.isNaN(date.getTime()))return "";const pad=n=>String(n).padStart(2,"0");return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`}

export default function AgentAppointments(){
  const [appointments,setAppointments]=useState([]),[summary,setSummary]=useState({}),[loading,setLoading]=useState(true),[savingReference,setSavingReference]=useState(""),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const [filters,setFilters]=useState({status:"",search:"",upcoming:"",date_from:"",date_to:""});
  const [rescheduleTarget,setRescheduleTarget]=useState(null);
  const [confirmTarget,setConfirmTarget]=useState(null);
  const [confirmForm,setConfirmForm]=useState({location:"",preparation:""});
  const [page,setPage]=useState(1);
  const [rescheduleForm,setRescheduleForm]=useState({starts_at:"",ends_at:""});

  async function loadSummary(){try{setSummary(await getAgentAppointmentSummary())}catch{}}
  useEffect(()=>{loadSummary()},[]);
  useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{setLoading(true);setError("");getAgentAppointments({...filters,upcoming:filters.upcoming||undefined}).then(rows=>active&&setAppointments(rows)).catch(err=>active&&setError(getApiErrorMessage(err,"Impossible de charger les rendez-vous."))).finally(()=>active&&setLoading(false))},180);return()=>{active=false;window.clearTimeout(timer)}},[filters]);

  const visible=useMemo(()=>appointments,[appointments]);
  const perPage=8;
  const totalPages=Math.max(1,Math.ceil(visible.length/perPage));
  const pageRows=visible.slice((page-1)*perPage,page*perPage);
  useEffect(()=>{setPage(1)},[filters.status,filters.search,filters.upcoming,filters.date_from,filters.date_to]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  function openConfirm(item){
    setConfirmTarget(item);
    setConfirmForm({
      location:item.location||"",
      preparation:item.preparationInstructions||item.preparation||"",
    });
  }

  async function confirmAppointment(){
    if(!confirmTarget)return;
    const item=confirmTarget;
    const patch={status:"confirmed"};
    if(confirmForm.location.trim())patch.location=confirmForm.location.trim();
    if(confirmForm.preparation.trim())patch.preparation_instructions=confirmForm.preparation.trim();

    setError("");setNotice("");setSavingReference(item.reference);
    try{
      await updateAgentAppointment(item.reference,patch);
      setNotice("Rendez-vous confirmé. Les informations de préparation sont visibles côté citoyen.");
      await loadSummary();
      setAppointments(rows=>rows.map(row=>row.reference===item.reference?{
        ...row,
        ...patch,
        status:"confirmed",
        statusLabel:getAppointmentStatusLabel("confirmed"),
        preparationInstructions:patch.preparation_instructions||row.preparationInstructions,
        preparation:patch.preparation_instructions||row.preparation,
      }:row));
      setConfirmTarget(null);
    }catch(err){
      setError(getApiErrorMessage(err,"Impossible de confirmer le rendez-vous."));
    }finally{
      setSavingReference("");
    }
  }

  async function setStatus(item,status){
    setError("");setNotice("");setSavingReference(item.reference);
    try{
      const patch={status};
      await updateAgentAppointment(item.reference,patch);
      setNotice(`Rendez-vous ${getAppointmentStatusLabel(status).toLowerCase()}.`);
      await loadSummary();
      setAppointments(rows=>rows.map(row=>row.reference===item.reference?{...row,...patch,status,statusLabel:getAppointmentStatusLabel(status)}:row));
    }catch(err){
      setError(getApiErrorMessage(err,"Impossible de mettre à jour le rendez-vous."));
    }finally{
      setSavingReference("");
    }
  }
  function openReschedule(item){
    setRescheduleTarget(item);
    setRescheduleForm({starts_at:toLocalInput(item.startsAt),ends_at:toLocalInput(item.endsAt)});
  }
  async function reschedule(event){
    event.preventDefault();
    if(!rescheduleTarget)return;
    const start=new Date(rescheduleForm.starts_at),end=new Date(rescheduleForm.ends_at);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start){setError("Choisissez une heure de fin postérieure au début.");return}
    setSavingReference(rescheduleTarget.reference);setError("");
    try{
      const updated=await updateAgentAppointment(rescheduleTarget.reference,{starts_at:start.toISOString(),ends_at:end.toISOString()});
      setAppointments(rows=>rows.map(row=>row.reference===updated.reference?updated:row));
      setNotice("Rendez-vous replanifié.");setRescheduleTarget(null);await loadSummary();
    }catch(e){setError(getApiErrorMessage(e,"Replanification impossible."))}finally{setSavingReference("")}
  }

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Organisation" title="Rendez-vous citoyens" actions={<button className="secondary-action" onClick={()=>navigate('/agent/audit?resource_type=appointment')}>Audit des rendez-vous</button>}/>
    <main className="portal-content appointment-agent-page appointment-agent-v50">
      {notice?<div className="success-inline" role="status">{notice}</div>:null}{error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="metric-grid metric-grid--4 appointment-agent-metrics">
        <article><span>Aujourd’hui</span><strong>{summary.today||0}</strong><small>Rendez-vous du jour</small></article><article><span>À confirmer</span><strong>{summary.requested||0}</strong><small>Décision attendue</small></article><article><span>Confirmés</span><strong>{summary.confirmed||0}</strong><small>{summary.upcoming||0} à venir</small></article><article><span>Terminés</span><strong>{summary.completed||0}</strong><small>{summary.declined||0} refusés</small></article>
      </section>
      <section className="toolbar-card toolbar-card--stack">
        <div className="toolbar-line appointment-server-filters"><label className="portal-search"><span aria-hidden="true">⌕</span><input value={filters.search} onChange={e=>setFilters(v=>({...v,search:e.target.value}))} placeholder="Référence, motif, citoyen, service..."/></label><label><span className="sr-only">À venir</span><select value={filters.upcoming} onChange={e=>setFilters(v=>({...v,upcoming:e.target.value}))}><option value="">Tous les rendez-vous</option><option value="true">À venir uniquement</option></select></label><label><span>Du</span><input type="date" value={filters.date_from} onChange={e=>setFilters(v=>({...v,date_from:e.target.value}))}/></label><label><span>Au</span><input type="date" value={filters.date_to} onChange={e=>setFilters(v=>({...v,date_to:e.target.value}))}/></label></div>
        <div className="management-filter-row appointment-filter-row">{FILTERS.map(([value,label])=><button type="button" key={value||"all"} className={filters.status===value?"is-active":""} onClick={()=>setFilters(v=>({...v,status:value}))}>{label}</button>)}</div>
      </section>
      <section className="portal-card appointment-agent-list"><div className="portal-card__head"><div><span className="section-label">Agenda agent</span><h3>{visible.length} rendez-vous affiché{visible.length>1?"s":""}</h3></div><span className="request-list-hint">Filtres appliqués par l’API</span></div>
        {loading?<div className="loading-card">Chargement…</div>:<div className="agent-appointment-list">{visible.length?pageRows.map(item=><article key={item.reference} className={`agent-appointment status-${item.status}`}>
          <div className="agent-appointment__time"><b>{item.startTime||"—"}</b><span>{formatDate(item.date)}</span></div>
          <div className="agent-appointment__body"><div className="agent-appointment__title"><strong>{item.citizenName}</strong><em>{getAppointmentStatusLabel(item.status)}</em></div><span>{item.serviceName} · {item.reference}</span><p>{item.reason||"Motif non précisé"}</p><div className="agent-appointment__meta"><small>{item.slot||`${item.startTime} - ${item.endTime}`}</small><small>{item.citizenEmail||"—"}</small>{item.location?<small>Lieu : {item.location}</small>:null}{item.preparation?<small>Préparation : {item.preparation}</small>:null}</div>
          <div className="agent-appointment__actions">{item.status==="requested"?<><button className="primary-action" disabled={savingReference===item.reference} onClick={()=>openConfirm(item)}>Confirmer</button><button className="text-danger" disabled={savingReference===item.reference} onClick={()=>setStatus(item,"declined")}>Refuser</button></>:null}{item.status==="confirmed"?<><button className="primary-action" disabled={savingReference===item.reference} onClick={()=>setStatus(item,"completed")}>Terminer</button><button className="secondary-action" disabled={savingReference===item.reference} onClick={()=>openReschedule(item)}>Replanifier</button>{item.canCancel?<button className="text-danger" disabled={savingReference===item.reference} onClick={()=>setStatus(item,"cancelled")}>Annuler</button>:null}</>:null}</div></div>
        </article>):<div className="dashboard-empty">Aucun rendez-vous dans ce filtre.</div>}{visible.length?<PortalPagination page={page} totalPages={totalPages} totalItems={visible.length} perPage={perPage} onPageChange={setPage} itemLabel="rendez-vous" itemLabelPlural="rendez-vous"/>:null}</div>}
      </section>
      {rescheduleTarget?<div className="modal-backdrop" onClick={()=>setRescheduleTarget(null)}><form className="portal-modal compact-note-modal" onClick={e=>e.stopPropagation()} onSubmit={reschedule}><button type="button" className="modal-close" onClick={()=>setRescheduleTarget(null)}>×</button><span className="section-label">Replanification</span><h2>{rescheduleTarget.reference}</h2><label><span>Début</span><input type="datetime-local" required value={rescheduleForm.starts_at} onChange={e=>setRescheduleForm(v=>({...v,starts_at:e.target.value}))}/></label><label><span>Fin</span><input type="datetime-local" required value={rescheduleForm.ends_at} onChange={e=>setRescheduleForm(v=>({...v,ends_at:e.target.value}))}/></label><button className="primary-action" type="submit" disabled={savingReference===rescheduleTarget.reference}>{savingReference===rescheduleTarget.reference?"Enregistrement…":"Enregistrer le nouveau créneau"}</button></form></div>:null}

      <PortalActionDialog
        open={Boolean(confirmTarget)}
        eyebrow="Confirmation du rendez-vous"
        title="Confirmer ce rendez-vous"
        description="Vérifiez le rendez-vous et ajoutez les informations utiles au citoyen avant de le confirmer."
        icon="✓"
        tone="success"
        confirmLabel="Confirmer le rendez-vous"
        cancelLabel="Retour"
        busy={Boolean(confirmTarget&&savingReference===confirmTarget.reference)}
        onClose={()=>{if(!savingReference)setConfirmTarget(null)}}
        onConfirm={confirmAppointment}
        details={confirmTarget?[
          {label:"Citoyen",value:confirmTarget.citizenName},
          {label:"Service",value:confirmTarget.serviceName},
          {label:"Date",value:formatDate(confirmTarget.date)},
          {label:"Créneau",value:confirmTarget.slot||`${confirmTarget.startTime||"—"} – ${confirmTarget.endTime||"—"}`},
          {label:"Référence",value:confirmTarget.reference},
          {label:"Motif",value:confirmTarget.reason||"Non précisé"},
        ]:[]}
      >
        <div className="portal-action-dialog__fields">
          <label>
            <span>Lieu précis du rendez-vous</span>
            <input
              value={confirmForm.location}
              onChange={e=>setConfirmForm(v=>({...v,location:e.target.value}))}
              placeholder="Ex. Hôtel de ville · Guichet 2"
            />
          </label>
          <label className="full">
            <span>Instructions de préparation</span>
            <textarea
              rows="4"
              value={confirmForm.preparation}
              onChange={e=>setConfirmForm(v=>({...v,preparation:e.target.value}))}
              placeholder="Ex. Apporter une pièce d’identité et les documents originaux."
            />
          </label>
        </div>
        <p className="portal-action-dialog__hint">Ces informations seront visibles immédiatement dans la fiche du rendez-vous côté citoyen.</p>
      </PortalActionDialog>
    </main>
  </div></div>;
}
