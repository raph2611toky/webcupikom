import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createCitizenRequest, getCitizenRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const filters=["Toutes","Envoyée","En attente","En traitement","Action requise","Terminée"];
export default function CitizenRequests(){
  const [items,setItems]=useState([]),[services,setServices]=useState([]),[filter,setFilter]=useState("Toutes"),[query,setQuery]=useState(""),[showForm,setShowForm]=useState(false),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{const [r,s]=await Promise.all([getCitizenRequests(),getServices()]);setItems(r);setServices(s)}catch(e){setError(getApiErrorMessage(e,"Impossible de charger vos demandes."))}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  const rows=useMemo(()=>items.filter(r=>(filter==="Toutes"||r.status===filter)&&(!query||`${r.id} ${r.title} ${r.service}`.toLowerCase().includes(query.toLowerCase()))),[items,filter,query]);
  async function submit(e){e.preventDefault();setCreating(true);setError("");const form=new FormData(e.currentTarget);try{const created=await createCitizenRequest({service:Number(form.get('service')),title:form.get('title'),description:form.get('description'),priority:'normal'});setItems(current=>[created,...current]);setShowForm(false)}catch(err){setError(getApiErrorMessage(err,"Impossible d’envoyer la demande."))}finally{setCreating(false)}}
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Démarches" title="Mes demandes" actions={<button className="topbar-cta" onClick={()=>setShowForm(true)}>+ Nouvelle demande</button>}/><main className="portal-content">
    {error?<div className="error-card">{error}</div>:null}
    <section className="toolbar-card"><label className="portal-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une demande..."/></label><div className="filter-row filter-row--portal">{filters.map(f=><button className={f===filter?'is-active':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div></section>
    <section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<div className="portal-table portal-table--requests"><div className="portal-table__head"><span>Référence</span><span>Demande</span><span>Service</span><span>Statut</span><span>Mise à jour</span><span/></div>{rows.map(r=><button className="portal-table__row" key={r.id} onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(r.id)}`)}><span className="mono">{r.id}</span><strong>{r.title}</strong><span>{r.service}</span><span><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></span><span>{r.updated}</span><span>→</span></button>)}{rows.length===0?<p className="detail-copy">Aucune demande correspondante.</p>:null}</div>}</section>
    {showForm?<div className="modal-backdrop" onClick={()=>!creating&&setShowForm(false)}><form className="portal-modal" onClick={e=>e.stopPropagation()} onSubmit={submit}><button type="button" className="modal-close" onClick={()=>setShowForm(false)} disabled={creating}>×</button><span className="section-label">Nouvelle démarche</span><h2>Que souhaitez-vous signaler ?</h2><label><span>Service</span><select name="service" required defaultValue=""><option value="" disabled>Sélectionner</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label><span>Objet</span><input name="title" required placeholder="Ex. lampadaire défectueux"/></label><label><span>Description</span><textarea name="description" required rows="5" placeholder="Décrivez votre besoin..."/></label><button className="primary-action" type="submit" disabled={creating}>{creating?'Envoi…':'Envoyer la demande →'}</button></form></div>:null}
  </main></div></div>;
}
