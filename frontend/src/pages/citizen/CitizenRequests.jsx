import { useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { citizenRequests } from "../../data/mockData.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const filters=["Toutes","Envoyée","En attente","En traitement","Action requise","Terminée"];
export default function CitizenRequests(){
  const [filter,setFilter]=useState("Toutes"); const [query,setQuery]=useState(""); const [showForm,setShowForm]=useState(false);
  const rows=useMemo(()=>citizenRequests.filter(r=>(filter==="Toutes"||r.status===filter)&&(!query||`${r.id} ${r.title} ${r.service}`.toLowerCase().includes(query.toLowerCase()))),[filter,query]);
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Démarches" title="Mes demandes" actions={<button className="topbar-cta" onClick={()=>setShowForm(true)}>+ Nouvelle demande</button>}/><main className="portal-content">
    <section className="toolbar-card"><label className="portal-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une demande..."/></label><div className="filter-row filter-row--portal">{filters.map(f=><button className={f===filter?'is-active':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div></section>
    <section className="portal-card"><div className="portal-table portal-table--requests"><div className="portal-table__head"><span>Référence</span><span>Demande</span><span>Service</span><span>Statut</span><span>Mise à jour</span><span/></div>{rows.map(r=><button className="portal-table__row" key={r.id} onClick={()=>navigate(`/citizen/requests/${r.id}`)}><span className="mono">{r.id}</span><strong>{r.title}</strong><span>{r.service}</span><span><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></span><span>{r.updated}</span><span>→</span></button>)}</div></section>
    {showForm?<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="portal-modal" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();setShowForm(false)}}><button type="button" className="modal-close" onClick={()=>setShowForm(false)}>×</button><span className="section-label">Nouvelle démarche</span><h2>Que souhaitez-vous signaler ?</h2><label><span>Service</span><select><option>Transport</option><option>Habitat</option><option>Énergie</option><option>Administration</option></select></label><label><span>Objet</span><input placeholder="Ex. lampadaire défectueux"/></label><label><span>Description</span><textarea rows="5" placeholder="Décrivez votre besoin..."/></label><button className="primary-action" type="submit">Envoyer la demande →</button></form></div>:null}
  </main></div></div>;
}
