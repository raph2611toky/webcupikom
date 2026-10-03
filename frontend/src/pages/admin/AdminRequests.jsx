import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAdminRequests } from "../../api/requests.js";
import { getAdminServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
const filters=["Toutes","Envoyée","À traiter","En traitement","Action requise","Terminée"];
export default function AdminRequests(){
  const [items,setItems]=useState([]),[services,setServices]=useState([]),[filter,setFilter]=useState('Toutes'),[query,setQuery]=useState(''),[service,setService]=useState('Tous'),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;Promise.all([getAdminRequests(),getAdminServices()]).then(([r,s])=>{if(!mounted)return;setItems(r);setServices(s)}).catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger les demandes."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const rows=useMemo(()=>items.filter(r=>(filter==='Toutes'||r.status===filter)&&(service==='Tous'||String(r.serviceId)===service)&&(!query||`${r.ref} ${r.citizen} ${r.service}`.toLowerCase().includes(query.toLowerCase()))),[items,filter,query,service]);
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Supervision" title="Demandes citoyennes"/><main className="portal-content">{error?<div className="error-card">{error}</div>:null}<section className="toolbar-card toolbar-card--stack"><div className="toolbar-line"><label className="portal-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, service..."/></label><select value={service} onChange={e=>setService(e.target.value)}><option value="Tous">Tous</option>{services.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></div><div className="filter-row filter-row--portal">{filters.map(f=><button key={f} className={filter===f?'is-active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></section><section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<div className="portal-table portal-table--agent"><div className="portal-table__head"><span>Référence</span><span>Citoyen</span><span>Service</span><span>Priorité</span><span>Statut</span><span/></div>{rows.map(r=><button className="portal-table__row" key={r.ref} onClick={()=>navigate(`/admin/requests/${encodeURIComponent(r.ref)}`)}><span className="mono">{r.ref}</span><strong>{r.citizen}</strong><span>{r.service}</span><span>{r.priority}</span><span><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></span><span>→</span></button>)}{!rows.length?<p className="detail-copy">Aucune demande correspondante.</p>:null}</div>}</section></main></div></div>;
}
