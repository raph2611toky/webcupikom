import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizens } from "../../api/citizens.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AgentCitizens(){
  const [items,setItems]=useState([]),[q,setQ]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getCitizens().then(data=>mounted&&setItems(data)).catch(()=>mounted&&setError("Impossible de charger les citoyens liés aux demandes.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const rows=useMemo(()=>items.filter(c=>!q||`${c.name} ${c.id} ${c.email}`.toLowerCase().includes(q.toLowerCase())),[items,q]);
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Population" title="Citoyens"/><main className="portal-content">{error?<div className="error-card">{error}</div>:null}<section className="toolbar-card"><label className="portal-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un citoyen..."/></label></section><section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<div className="portal-table portal-table--citizens"><div className="portal-table__head"><span>Citoyen</span><span>ID</span><span>Email</span><span>Demandes</span><span>Statut</span><span/></div>{rows.map(c=><button className="portal-table__row" key={c.id} onClick={()=>navigate(`/agent/citizens/${c.id}`)}><strong>{c.name}</strong><span className="mono">#{c.id}</span><span>{c.email||'—'}</span><span>{c.requests}</span><span><em className="status-pill status-actif">{c.status}</em></span><span>→</span></button>)}</div>}</section></main></div></div>;
}
