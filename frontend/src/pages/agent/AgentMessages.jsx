import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentContactMessages } from "../../api/contact.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

export default function AgentMessages(){
  const [items,setItems]=useState([]),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;getAgentContactMessages().then(data=>mounted&&setItems(data)).catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger les messages citoyens."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const isPrivacy=(item)=>String(item.subject||"").startsWith("[Données personnelles]");
  const rows=useMemo(()=>items.filter(x=>{
    const matchesFilter=filter==="all"||(filter==="privacy"?isPrivacy(x):x.statusCode===filter);
    const matchesQuery=!query||`${x.reference} ${x.name} ${x.email} ${x.subject} ${x.service_name||""}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter&&matchesQuery;
  }),[items,query,filter]);
  const counts=useMemo(()=>({received:items.filter(x=>x.statusCode==="received").length,read:items.filter(x=>x.statusCode==="read").length,closed:items.filter(x=>x.statusCode==="closed").length,privacy:items.filter(isPrivacy).length}),[items]);
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Relations citoyennes" title="Messages reçus"/><main className="portal-content agent-messages-v50">{error?<div className="error-card">{error}</div>:null}
    <section className="metric-grid metric-grid--3 compact-agent-metrics"><button className="metric-action" onClick={()=>setFilter("received")}><span>À lire</span><strong>{counts.received}</strong><small>Nouveaux messages</small></button><button className="metric-action" onClick={()=>setFilter("read")}><span>Lus</span><strong>{counts.read}</strong><small>À traiter / assigner</small></button><button className="metric-action" onClick={()=>setFilter("closed")}><span>Clôturés</span><strong>{counts.closed}</strong><small>Historique</small></button></section>
    <section className="toolbar-card toolbar-card--stack"><div className="toolbar-line"><label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un message" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, sujet, service..."/></label></div><div className="filter-row filter-row--portal">{[["all","Tous"],["received","Reçus"],["read","Lus"],["closed","Clôturés"],["privacy",`Données personnelles (${counts.privacy})`]].map(([v,l])=><button type="button" key={v} aria-pressed={filter===v} className={filter===v?"is-active":""} onClick={()=>setFilter(v)}>{l}</button>)}</div></section>
    <section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<div className="portal-table portal-table--messages"><div className="portal-table__head"><span>Référence</span><span>Expéditeur</span><span>Sujet</span><span>Statut</span><span>Date</span><span/></div>{rows.map(item=><button className="portal-table__row" key={item.reference} onClick={()=>navigate(`/agent/messages/${encodeURIComponent(item.reference)}`)}><span className="mono">{item.reference}</span><strong>{item.name}</strong><span>{item.subject}</span><span><em className={`status-pill status-${item.statusCode}`}>{item.statusLabel}</em></span><span>{item.createdLabel}</span><span>→</span></button>)}{!rows.length?<p className="detail-copy">Aucun message correspondant.</p>:null}</div>}</section>
  </main></div></div>;
}
