import { useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { citizens } from "../../data/mockData.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AgentCitizens(){const[q,setQ]=useState('');const rows=useMemo(()=>citizens.filter(c=>!q||`${c.name} ${c.id} ${c.district}`.toLowerCase().includes(q.toLowerCase())),[q]);return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Population" title="Citoyens"/><main className="portal-content"><section className="toolbar-card"><label className="portal-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un citoyen..."/></label></section><section className="portal-card"><div className="portal-table portal-table--citizens"><div className="portal-table__head"><span>Citoyen</span><span>ID</span><span>District</span><span>Demandes</span><span>Statut</span><span/></div>{rows.map(c=><button className="portal-table__row" key={c.id} onClick={()=>navigate(`/agent/citizens/${c.id}`)}><strong>{c.name}</strong><span className="mono">{c.id}</span><span>{c.district}</span><span>{c.requests}</span><span><em className="status-pill status-actif">{c.status}</em></span><span>→</span></button>)}</div></section></main></div></div>}
