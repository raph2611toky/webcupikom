import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentServices(){
  const [items,setItems]=useState([]);
  useEffect(()=>{getServices().then(setItems).catch(()=>setItems([]))},[]);
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Catalogue municipal" title="Services municipaux"/>
    <main className="portal-content"><section className="portal-card management-list">
      {items.map(item=><article key={item.slug} className="management-row">
        <div className="management-row__main"><div className="service-admin-icon">{item.icon}</div><div><span>{item.category}</span><h3>{item.name}</h3><p>{item.shortDescription}</p></div></div>
        <div className="management-row__actions"><button className="secondary-action" onClick={()=>navigate(`/agent/services/${item.slug}`)}>Consulter →</button></div>
      </article>)}
    </section></main>
  </div></div>;
}
