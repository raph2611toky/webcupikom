import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { ServiceAvailabilityBadge } from "../../components/ui/ServiceAvailability.jsx";
import { getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { isReducedDataMode } from "../../utils/performance.js";
import { useDataMode } from "../../utils/useDataMode.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Ville",title:"Services municipaux",open:"Voir le service",search:"Rechercher un service",all:"Tous",cards:"Cartes",map:"Carte 2D",result:"service",results:"services",empty:"Aucun service ne correspond à votre recherche.",available:"Disponibles",unavailable:"Indisponibles",next:"Alternative"},
  en:{eyebrow:"City",title:"City services",open:"View service",search:"Search for a service",all:"All",cards:"Cards",map:"2D map",result:"service",results:"services",empty:"No service matches your search.",available:"Available",unavailable:"Unavailable",next:"Alternative"},
  mg:{eyebrow:"Tanàna",title:"Sampan-draharahan'ny tanàna",open:"Hijery ny sampan-draharaha",search:"Hitady sampan-draharaha",all:"Rehetra",cards:"Karatra",map:"Sarintany 2D",result:"sampan-draharaha",results:"sampan-draharaha",empty:"Tsy misy sampan-draharaha mifanaraka amin'ny fikarohanao.",available:"Azo ampiasaina",unavailable:"Tsy azo ampiasaina",next:"Safidy hafa"},
};

const NovaTerraMap=lazy(()=>import("../../components/NovaTerraMap/NovaTerraMap.jsx"));
const TONES=["blue","orange","green","pink","purple","cyan","teal","violet"];

function serviceTone(service,index){
  const text=`${service?.slug||""} ${service?.name||""} ${service?.category||""}`.toLowerCase();
  if(/admin|etat|état|civil/.test(text))return "blue";
  if(/energie|énergie|electric|électric/.test(text))return "orange";
  if(/habitat|logement|résidence|residence/.test(text))return "green";
  if(/santé|sante|health/.test(text))return "pink";
  if(/sécurité|securite|security/.test(text))return "purple";
  if(/transport|mobilit/.test(text))return "cyan";
  if(/eau|voirie|déchet|dechet|infrastructure/.test(text))return "teal";
  return TONES[index%TONES.length];
}

export default function CitizenServices(){
  const [locale]=useLocale();
  const dataProfile=useDataMode();
  const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [availability,setAvailability]=useState("all");
  const [view,setView]=useState(()=>localStorage.getItem("nova_terra_services_view")||(isReducedDataMode()?"cards":"map"));

  useEffect(()=>{
    let active=true;
    const refresh=()=>getServices({force:true}).then(rows=>active&&setServices(rows)).catch(()=>{});
    getServices().then(rows=>active&&setServices(rows)).catch(()=>active&&setServices([]));
    const onFocus=()=>refresh();
    window.addEventListener("focus",onFocus);
    return()=>{active=false;window.removeEventListener("focus",onFocus)};
  },[locale]);
  useEffect(()=>{if(dataProfile.reduced&&!localStorage.getItem("nova_terra_services_view"))setView("cards")},[dataProfile.reduced]);

  const prepared=useMemo(()=>services.map((service,index)=>({...service,tone:serviceTone(service,index)})),[services]);
  const categories=useMemo(()=>Array.from(new Set(prepared.map(item=>item.category).filter(Boolean))),[prepared]);
  const counts=useMemo(()=>({available:prepared.filter(item=>item.isAvailable!==false).length,unavailable:prepared.filter(item=>item.isAvailable===false).length}),[prepared]);

  const filtered=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return prepared.filter(service=>{
      const matchesCategory=category==="all"||service.category===category;
      const matchesAvailability=availability==="all"||(availability==="available"?service.isAvailable!==false:service.isAvailable===false);
      const matchesText=!normalized||`${service.name} ${service.category} ${service.shortDescription||""} ${service.description||""} ${service.unavailabilityReason||""}`.toLowerCase().includes(normalized);
      return matchesCategory&&matchesAvailability&&matchesText;
    });
  },[prepared,query,category,availability]);

  const visibleSlugs=useMemo(()=>new Set(filtered.map(item=>item.slug)),[filtered]);
  function changeView(next){setView(next);localStorage.setItem("nova_terra_services_view",next)}

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content citizen-services-page">
      <section className="services-view-toolbar" aria-label="Affichage et filtres des services">
        <label className="services-search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search}/></label>
        <div className="services-category-filters" role="group" aria-label="Filtrer par catégorie"><button type="button" className={category==="all"?"is-active":""} aria-pressed={category==="all"} onClick={()=>setCategory("all")}>{copy.all}</button>{categories.map(item=><button type="button" key={item} className={category===item?"is-active":""} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="services-view-switch" role="group" aria-label="Choisir la vue"><button type="button" className={view==="cards"?"is-active":""} aria-pressed={view==="cards"} onClick={()=>changeView("cards")}><i aria-hidden="true">▦</i><span>{copy.cards}</span></button><button type="button" className={view==="map"?"is-active":""} aria-pressed={view==="map"} onClick={()=>changeView("map")}><i aria-hidden="true">◇</i><span>{copy.map}</span></button></div>
      </section>

      <div className="services-filter-summary services-filter-summary--availability" aria-live="polite">
        <span>{filtered.length} {filtered.length>1?copy.results:copy.result}</span>
        <div className="service-availability-filters" role="group" aria-label="Filtrer par disponibilité">
          <button type="button" className={availability==="all"?"is-active":""} onClick={()=>setAvailability("all")}>{copy.all} <b>{prepared.length}</b></button>
          <button type="button" className={`is-ok ${availability==="available"?"is-active":""}`} onClick={()=>setAvailability("available")}>{copy.available} <b>{counts.available}</b></button>
          <button type="button" className={`is-down ${availability==="unavailable"?"is-active":""}`} onClick={()=>setAvailability("unavailable")}>{copy.unavailable} <b>{counts.unavailable}</b></button>
        </div>
        {(query||category!=="all"||availability!=="all")?<button type="button" onClick={()=>{setQuery("");setCategory("all");setAvailability("all")}}>Réinitialiser</button>:null}
      </div>

      {view==="map"?<Suspense fallback={<div className="map-lazy-fallback" role="status">Chargement de la carte 2D…</div>}><NovaTerraMap services={prepared} visibleSlugs={visibleSlugs} locale={locale}/></Suspense>:filtered.length?<section className="citizen-service-grid citizen-service-grid--v39">
        {filtered.map(service=><article key={service.slug} className={`citizen-service-card service-tone-${service.tone} ${service.isAvailable===false?"is-unavailable":""}`}>
          <div className="citizen-service-card__decor" aria-hidden="true"/><div className="citizen-service-card__icon" aria-hidden="true">{service.icon}</div>
          <div className="citizen-service-card__statusline"><span className="citizen-service-card__category">{service.category}</span><ServiceAvailabilityBadge service={service} compact/></div>
          <h2>{service.name}</h2>
          <p>{service.isAvailable===false?(service.unavailabilityReason||"Service temporairement interrompu."):service.shortDescription}</p>
          {service.isAvailable===false&&service.alternativeAction?<small className="citizen-service-card__alternative"><b>{copy.next} :</b> {service.alternativeAction}</small>:null}
          <span className="citizen-service-card__watermark" aria-hidden="true">{service.icon}</span>
          <button className="citizen-service-card__cta" type="button" onClick={()=>navigate(`/citizen/services/${service.slug}`)}><span>{copy.open}</span><i aria-hidden="true">→</i></button>
        </article>)}
      </section>:<div className="services-empty-state"><i aria-hidden="true">⌕</i><strong>{copy.empty}</strong></div>}
    </main>
  </div></div>;
}
