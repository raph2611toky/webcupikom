import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getService } from "../../api/services.js";
import { getLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function ServiceDetails({ params }) {
  const { isAuthenticated, user } = useAuth();
  const [service,setService]=useState(undefined);
  const [error,setError]=useState("");
  const locale=getLocale();

  useEffect(()=>{
    getService(params.slug).then(setService).catch(()=>{setService(null);setError(locale==="en"?"Service not found.":"Service introuvable.")});
  },[params.slug,locale]);

  function startRequest(){
    const target=`/citizen/requests?new=1&subject=${encodeURIComponent(service?.name||"")}`;
    if(isAuthenticated&&user?.role==="citizen")navigate(target);
    else navigate(`/login?next=${encodeURIComponent(target)}`);
  }

  if(service===undefined) return null;

  if(!service) return <div className="public-page public-page--service-detail"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>{error||"Service introuvable"}</h1><button className="primary-button" onClick={()=>navigate("/services")}>{locale==="en"?"Back to services":"Retour aux services"}</button></div></main><Footer/></div>;

  return <div className="public-page public-page--service-detail">
    <PublicHeader/>
    <main>
      <section className="service-detail-hero">
        <button className="text-link" onClick={()=>navigate("/services")}>← {locale==="en"?"All services":"Tous les services"}</button>
        <div className="service-detail-hero__icon" aria-hidden="true">{service.icon}</div>
        <span>{service.category}</span>
        <h1>{service.name}</h1>
        <p>{service.description}</p>
        <button className="primary-button" onClick={startRequest}>{locale==="en"?"Start a request":"Faire une demande"}</button>
      </section>

      <section className="service-detail-grid public-content">
        <article className="info-panel info-panel--large">
          <span className="panel-kicker">{locale==="en"?"PROCEDURES":"DÉMARCHES"}</span>
          <h2>{locale==="en"?"What you can do":"Ce que vous pouvez faire"}</h2>
          <div className="action-list">{(service.actions||[]).map((item,i)=><div key={item}><b>{String(i+1).padStart(2,"0")}</b><span>{item}</span><i aria-hidden="true">→</i></div>)}</div>
        </article>

        <article className="info-panel">
          <span className="panel-kicker">{locale==="en"?"HOURS":"HORAIRES"}</span>
          <h3>{service.openingHours||(locale==="en"?"To confirm":"À confirmer")}</h3>
          <p>{service.address}</p>
        </article>

        <article className="info-panel">
          <span className="panel-kicker">{locale==="en"?"CONTACT":"COORDONNÉES"}</span>
          <h3>{service.phone||"—"}</h3>
          <p>{service.email}</p>
        </article>

        <article className="info-panel info-panel--large">
          <span className="panel-kicker">{locale==="en"?"REQUIRED DOCUMENTS":"DOCUMENTS NÉCESSAIRES"}</span>
          <h2>{locale==="en"?"Prepare your request":"Préparez votre dossier"}</h2>
          <ul>{(service.requiredDocuments||[]).map(item=><li key={item}>{item}</li>)}</ul>
        </article>
      </section>
    </main>
    <Footer/>
  </div>;
}
