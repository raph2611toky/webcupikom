import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { ServiceAvailabilityBadge, ServiceAvailabilityNotice } from "../../components/ui/ServiceAvailability.jsx";
import ServiceAvailabilityEditor from "../../components/ui/ServiceAvailabilityEditor.jsx";
import { getService } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentServiceDetails({params}) {
  const [service,setService]=useState(undefined);
  useEffect(()=>{let active=true;getService(params.slug,{force:true}).then(data=>active&&setService(data)).catch(()=>active&&setService(null));return()=>{active=false}},[params.slug]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Catalogue municipal" title={service?.name || "Service municipal"}/>
    <main className="portal-content portal-detail-page service-agent-detail-page">
      <button className="back-link" onClick={()=>navigate("/agent/services")}>← Retour aux services</button>
      {!service ? <section className="portal-card portal-empty-centered"><h2>{service===undefined?"Chargement…":"Service introuvable"}</h2></section> : <>
        <section className="service-portal-hero service-portal-hero--availability"><div className="service-portal-hero__icon" aria-hidden="true">{service.icon}</div><div className="service-portal-hero__copy"><div className="service-detail-heading-line"><span>{service.category}</span><ServiceAvailabilityBadge service={service}/></div><h2>{service.name}</h2><p>{service.description||service.shortDescription}</p></div></section>
        <ServiceAvailabilityNotice service={service}/>
        <section className="portal-detail-grid service-agent-detail-grid">
          <article className="portal-card"><span className="section-label">Horaires</span><h3>{service.openingHours||"—"}</h3><p className="detail-copy">{service.address||"Adresse non renseignée"}</p></article>
          <article className="portal-card"><span className="section-label">Contact</span><h3>{service.phone||"—"}</h3><p className="detail-copy">{service.email||"E-mail non renseigné"}</p></article>
          <article className="portal-card"><span className="section-label">Démarches</span><div className="portal-action-list">{(service.actions||[]).map((item,index)=><div key={`${item}-${index}`}><i>{String(index+1).padStart(2,"0")}</i><span>{String(item)}</span></div>)}</div></article>
          <article className="portal-card portal-card--wide"><ServiceAvailabilityEditor service={service} role="agent" onSaved={setService}/></article>
        </section>
      </>}
    </main>
  </div></div>;
}
