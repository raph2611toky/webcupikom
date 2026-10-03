import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getService } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const COPY={
  fr:{missing:"Service introuvable",back:"Retour aux services",all:"Tous les services",request:"Faire une demande",steps:"Démarches",can:"Ce que vous pouvez faire",hours:"Horaires",confirm:"À confirmer",contact:"Coordonnées",docs:"Documents nécessaires",prepare:"Préparez votre dossier"},
  en:{missing:"Service not found",back:"Back to services",all:"All services",request:"Start a request",steps:"Procedures",can:"What you can do",hours:"Opening hours",confirm:"To confirm",contact:"Contact",docs:"Required documents",prepare:"Prepare your request"},
  mg:{missing:"Tsy hita ny sampan-draharaha",back:"Hiverina amin'ny sampan-draharaha",all:"Sampan-draharaha rehetra",request:"Hanao fangatahana",steps:"Dingana",can:"Ireo azonao atao",hours:"Ora fiasana",confirm:"Mbola hohamafisina",contact:"Fifandraisana",docs:"Taratasy ilaina",prepare:"Omano ny fangatahanao"},
};

export default function ServiceDetails({params}){
  const {isAuthenticated,user}=useAuth();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [service,setService]=useState(undefined);

  useEffect(()=>{setService(undefined);getService(params.slug).then(setService).catch(()=>setService(null))},[params.slug,locale]);

  if(service===undefined)return null;
  if(!service)return <div className="public-page public-page--service-detail"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>{copy.missing}</h1><button className="primary-button" onClick={()=>navigate('/services')}>{copy.back}</button></div></main><Footer/></div>;

  function start(){
    const next=`/citizen/requests?new=1&subject=${encodeURIComponent(service.name)}`;
    navigate(isAuthenticated&&user?.role==="citizen"?next:`/login?next=${encodeURIComponent(next)}`);
  }

  return <div className="public-page public-page--service-detail"><PublicHeader/><main>
    <section className="service-detail-hero"><button className="text-link" onClick={()=>navigate('/services')}>← {copy.all}</button><div className="service-detail-hero__icon" aria-hidden="true">{service.icon}</div><span>{service.category}</span><h1>{service.name}</h1><p>{service.description}</p><button className="primary-button" onClick={start}>{copy.request}</button></section>
    <section className="service-detail-grid public-content">
      <article className="info-panel info-panel--large"><span className="panel-kicker">{copy.steps}</span><h2>{copy.can}</h2><div className="action-list">{(service.actions||[]).map((item,i)=><div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span><i aria-hidden="true">→</i></div>)}</div></article>
      <article className="info-panel"><span className="panel-kicker">{copy.hours}</span><h3>{service.openingHours||copy.confirm}</h3><p>{service.address}</p></article>
      <article className="info-panel"><span className="panel-kicker">{copy.contact}</span><h3>{service.phone||"—"}</h3><p>{service.email}</p></article>
      <article className="info-panel info-panel--large"><span className="panel-kicker">{copy.docs}</span><h2>{copy.prepare}</h2><ul>{(service.requiredDocuments||[]).map(item=><li key={item}>{item}</li>)}</ul></article>
    </section>
  </main><Footer/></div>;
}
