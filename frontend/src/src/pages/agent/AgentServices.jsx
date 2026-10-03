import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { ServiceAvailabilityBadge } from "../../components/ui/ServiceAvailability.jsx";
import ServiceAvailabilityEditor from "../../components/ui/ServiceAvailabilityEditor.jsx";
import { getServices } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentServices(){
  const [items,setItems]=useState([]);
  const [editing,setEditing]=useState(null);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");

  const load=()=>getServices({force:true}).then(setItems).catch(()=>setItems([]));
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>items.filter(item=>{
    const matchesStatus=filter==="all"||(filter==="available"?item.isAvailable!==false:item.isAvailable===false);
    const term=query.trim().toLowerCase();
    const matchesText=!term||`${item.name} ${item.category} ${item.unavailabilityReason||""}`.toLowerCase().includes(term);
    return matchesStatus&&matchesText;
  }),[items,query,filter]);

  const down=items.filter(item=>item.isAvailable===false).length;

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Catalogue municipal" title="Services municipaux"/>
    <main className="portal-content service-management-page">
      <section className="service-management-summary">
        <div><strong>{items.length}</strong><span>services</span></div><div className={down?"is-warning":""}><strong>{down}</strong><span>indisponible{down>1?"s":""}</span></div>
        <label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un service"/></label>
        <div className="service-management-filters"><button className={filter==="all"?"is-active":""} onClick={()=>setFilter("all")}>Tous</button><button className={filter==="available"?"is-active":""} onClick={()=>setFilter("available")}>Disponibles</button><button className={filter==="unavailable"?"is-active":""} onClick={()=>setFilter("unavailable")}>Indisponibles</button></div>
      </section>

      <section className="portal-card management-list service-management-list">
        {filtered.map(item=><article key={item.slug} className={`management-row service-management-row ${item.isAvailable===false?"is-unavailable":""}`}>
          <div className="management-row__main"><div className="service-admin-icon">{item.icon}</div><div><span>{item.category}</span><h3>{item.name}</h3><p>{item.isAvailable===false?(item.unavailabilityReason||"Interruption connue"):item.shortDescription}</p></div></div>
          <div className="management-row__meta"><ServiceAvailabilityBadge service={item}/>{item.isAvailable===false&&item.expectedRestoreAt?<span>Retour estimé : {new Date(item.expectedRestoreAt).toLocaleString("fr-FR")}</span>:null}</div>
          <div className="management-row__actions"><button className="secondary-action" onClick={()=>setEditing(item)}>Disponibilité</button><button className="secondary-action" onClick={()=>navigate(`/agent/services/${item.slug}`)}>Consulter →</button></div>
        </article>)}
        {!filtered.length?<div className="portal-empty-centered"><p>Aucun service correspondant.</p></div>:null}
      </section>
    </main>

    {editing?<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><section className="portal-modal service-availability-modal" role="dialog" aria-modal="true" aria-labelledby="agent-service-availability-title"><button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button><div><span className="section-label">Service municipal</span><h2 id="agent-service-availability-title">{editing.name}</h2></div><ServiceAvailabilityEditor service={editing} role="agent" onSaved={updated=>{setEditing(updated);setItems(rows=>rows.map(row=>row.slug===updated.slug?updated:row))}}/></section></div>:null}
  </div></div>;
}
