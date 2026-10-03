import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { ServiceAvailabilityBadge } from "../../components/ui/ServiceAvailability.jsx";
import { getServiceCategories, getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const COPY={
  fr:{kicker:"Services municipaux",title:<>Tout Nova Terra,<br/><em>au même endroit.</em></>,intro:"Horaires, contacts, démarches et état actuel de chaque service municipal.",search:"Rechercher un service...",all:"Tous",open:"Voir le service",available:"Disponibles",unavailable:"Indisponibles"},
  en:{kicker:"City services",title:<>All Nova Terra,<br/><em>in one place.</em></>,intro:"Opening hours, contacts, procedures and current status for every city service.",search:"Search a service...",all:"All",open:"View service",available:"Available",unavailable:"Unavailable"},
  mg:{kicker:"Sampan-draharahan'ny tanàna",title:<>Nova Terra manontolo,<br/><em>amin'ny toerana iray.</em></>,intro:"Ora fiasana, fifandraisana, dingana ary satan'ny sampan-draharaha tsirairay.",search:"Hitady sampan-draharaha...",all:"Rehetra",open:"Hijery ny sampan-draharaha",available:"Azo ampiasaina",unavailable:"Tsy azo ampiasaina"},
};

export default function Services() {
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);
  const [categories,setCategories]=useState(["Tous"]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("Tous");
  const [availability,setAvailability]=useState("all");

  useEffect(()=>{setCategory("Tous");Promise.all([getServices({force:true}),getServiceCategories()]).then(([s,c])=>{setServices(s);setCategories(c)})},[locale]);

  const filtered=useMemo(()=>services.filter((service)=>{
    const matchCategory=category==="Tous"||service.category===category;
    const matchAvailability=availability==="all"||(availability==="available"?service.isAvailable!==false:service.isAvailable===false);
    const term=query.trim().toLowerCase();
    const matchQuery=!term||`${service.name} ${service.shortDescription} ${service.unavailabilityReason||""}`.toLowerCase().includes(term);
    return matchCategory&&matchAvailability&&matchQuery;
  }),[services,query,category,availability]);

  return <div className="public-page public-page--services"><PublicHeader/><main>
    <section className="public-hero public-hero--compact"><span className="public-kicker">{copy.kicker}</span><h1>{copy.title}</h1><p>{copy.intro}</p><label className="public-search"><span aria-hidden="true">⌕</span><input aria-label={copy.search} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={copy.search}/></label></section>
    <section className="public-content">
      <div className="filter-row public-service-filters">{categories.map((item)=><button key={item} className={category===item?"is-active":""} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item==="Tous"?copy.all:item}</button>)}<span className="public-filter-divider" aria-hidden="true"/><button className={availability==="available"?"is-active":""} onClick={()=>setAvailability(availability==="available"?"all":"available")}>{copy.available}</button><button className={availability==="unavailable"?"is-active":""} onClick={()=>setAvailability(availability==="unavailable"?"all":"unavailable")}>{copy.unavailable}</button></div>
      <div className="service-grid">{filtered.map((service)=><article className={`service-card ${service.isAvailable===false?"is-unavailable":""}`} key={service.slug}>
        <div className="service-card__icon" aria-hidden="true">{service.icon}</div><div className="public-service-card__head"><span>{service.category}</span><ServiceAvailabilityBadge service={service} compact/></div><h2>{service.name}</h2><p>{service.isAvailable===false?(service.unavailabilityReason||"Service temporairement interrompu."):service.shortDescription}</p>{service.isAvailable===false&&service.alternativeAction?<small className="public-service-alternative">Alternative : {service.alternativeAction}</small>:null}<button onClick={()=>navigate(`/services/${service.slug}`)}>{copy.open} <b>→</b></button>
      </article>)}</div>
    </section>
  </main><Footer/></div>;
}
