import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getService } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function ServiceDetails({ params }) {
  const [service,setService]=useState(undefined);
  useEffect(()=>{getService(params.slug).then(setService)},[params.slug]);
  if(service===undefined) return null;
  if (!service) return <div className="public-page public-page--service-detail"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>Service introuvable</h1><button className="primary-button" onClick={()=>navigate('/services')}>Retour aux services</button></div></main><Footer/></div>;
  return <div className="public-page public-page--service-detail"><PublicHeader /><main>
    <section className="service-detail-hero"><button className="text-link" onClick={()=>navigate('/services')}>← Tous les services</button><div className="service-detail-hero__icon">{service.icon}</div><span>{service.category}</span><h1>{service.name}</h1><p>{service.description}</p><button className="primary-button" onClick={()=>navigate('/login?next=/citizen/requests')}>Faire une demande</button></section>
    <section className="service-detail-grid public-content">
      <article className="info-panel info-panel--large"><span className="panel-kicker">Démarches</span><h2>Ce que vous pouvez faire</h2><div className="action-list">{(service.actions||[]).map((item,i)=><div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span><i>→</i></div>)}</div></article>
      <article className="info-panel"><span className="panel-kicker">Horaires</span><h3>{service.openingHours||"À confirmer"}</h3><p>{service.address}</p></article>
      <article className="info-panel"><span className="panel-kicker">Coordonnées</span><h3>{service.phone||"—"}</h3><p>{service.email}</p></article>
      <article className="info-panel info-panel--large"><span className="panel-kicker">Documents nécessaires</span><h2>Préparez votre dossier</h2><ul>{(service.requiredDocuments||[]).map(item=><li key={item}>{item}</li>)}</ul></article>
    </section>
  </main><Footer/></div>;
}
