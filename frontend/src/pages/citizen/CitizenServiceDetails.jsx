import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getService } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY = {
  fr: {
    eyebrow:"Services municipaux", back:"Retour aux services", request:"Faire une demande",
    actions:"Démarches disponibles", documents:"Documents requis", hours:"Horaires",
    contact:"Contact", address:"Adresse", none:"Aucune information disponible."
  },
  en: {
    eyebrow:"City services", back:"Back to services", request:"Start a request",
    actions:"Available procedures", documents:"Required documents", hours:"Opening hours",
    contact:"Contact", address:"Address", none:"No information available."
  },
  mg: {
    eyebrow:"Sampan-draharahan'ny tanàna", back:"Hiverina amin'ny sampan-draharaha", request:"Hanao fangatahana",
    actions:"Dingana azo atao", documents:"Taratasy ilaina", hours:"Ora fiasana",
    contact:"Fifandraisana", address:"Adiresy", none:"Tsy misy vaovao."
  },
};

export default function CitizenServiceDetails({ params }) {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [service,setService]=useState(undefined);

  useEffect(()=>{
    let active=true;
    setService(undefined);
    getService(params.slug)
      .then(data=>active&&setService(data))
      .catch(()=>active&&setService(null));
    return()=>{active=false};
  },[params.slug,locale]);

  if(service===undefined) {
    return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title="…" />
      <main className="portal-content"><div className="loading-card">Chargement…</div></main>
    </div></div>;
  }

  if(!service) {
    return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.eyebrow}/>
      <main className="portal-content">
        <section className="portal-card portal-empty-centered">
          <h2>{copy.none}</h2>
          <button className="primary-action" onClick={()=>navigate("/citizen/services")}>{copy.back}</button>
        </section>
      </main>
    </div></div>;
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={service.name} />
      <main className="portal-content portal-detail-page">
        <button className="back-link" onClick={()=>navigate("/citizen/services")}>← {copy.back}</button>

        <section className="service-portal-hero">
          <div className="service-portal-hero__icon" aria-hidden="true">{service.icon}</div>
          <div className="service-portal-hero__copy">
            <span>{service.category}</span>
            <h2>{service.name}</h2>
            <p>{service.description || service.shortDescription}</p>
          </div>
          <button className="primary-action service-portal-hero__cta" onClick={()=>navigate(`/citizen/requests?new=1&subject=${encodeURIComponent(service.name)}`)}>{copy.request}</button>
        </section>

        <section className="portal-detail-grid">
          <article className="portal-card">
            <span className="section-label">{copy.actions}</span>
            <div className="portal-action-list">
              {(service.actions||[]).length ? (service.actions||[]).map((item,index)=><div key={item}><i>{String(index+1).padStart(2,"0")}</i><span>{item}</span></div>) : <p className="detail-copy">{copy.none}</p>}
            </div>
          </article>

          <article className="portal-card">
            <span className="section-label">{copy.documents}</span>
            <ul className="portal-document-list">
              {(service.requiredDocuments||[]).length ? (service.requiredDocuments||[]).map(item=><li key={item}>{item}</li>) : <li>{copy.none}</li>}
            </ul>
          </article>

          <article className="portal-card">
            <span className="section-label">{copy.hours}</span>
            <h3>{service.openingHours || "—"}</h3>
            <div className="portal-contact-block">
              <div><span>{copy.contact}</span><b>{service.phone || "—"}</b><small>{service.email || ""}</small></div>
              <div><span>{copy.address}</span><b>{service.address || "—"}</b></div>
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>;
}
