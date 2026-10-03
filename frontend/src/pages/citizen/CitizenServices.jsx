import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Ville",title:"Services municipaux",open:"Ouvrir le service"},
  en:{eyebrow:"City",title:"City services",open:"Open service"},
  mg:{eyebrow:"Tanàna",title:"Sampan-draharahan'ny tanàna",open:"Hijery ny sampan-draharaha"},
};

export default function CitizenServices(){
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);
  useEffect(()=>{getServices().then(setServices)},[locale]);
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/><main className="portal-content"><section className="citizen-service-grid">{services.map(s=><article key={s.slug}><i aria-hidden="true">{s.icon}</i><span>{s.category}</span><h2>{s.name}</h2><p>{s.shortDescription}</p><button onClick={()=>navigate(`/citizen/services/${s.slug}`)}>{copy.open} →</button></article>)}</section></main></div></div>;
}
