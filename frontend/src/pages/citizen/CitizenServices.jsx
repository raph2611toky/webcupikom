import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { ServiceAvailabilityBadge } from "../../components/ui/ServiceAvailability.jsx";
import { getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { isReducedDataMode } from "../../utils/performance.js";
import { useDataMode } from "../../utils/useDataMode.js";
import cityArt from "../../assets/services/city.png";
import adminArt from "../../assets/services/administration.png";
import energyArt from "../../assets/services/energy.png";
import healthArt from "../../assets/services/health.png";
import housingArt from "../../assets/services/housing.png";
import safetyArt from "../../assets/services/safety.png";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{
    eyebrow:"Ville",
    title:"Services municipaux",
    heroKicker:"SERVICES DE LA VILLE",
    heroTitle:"Votre ville, vos services",
    heroText:"Retrouvez rapidement tous les services municipaux, leur disponibilité actuelle et les démarches associées.",
    search:"Rechercher un service",
    all:"Tous",
    cards:"Cartes",
    map:"Carte 2D",
    result:"service",
    results:"services",
    empty:"Aucun service ne correspond à votre recherche.",
    available:"Disponibles",
    unavailable:"Indisponibles",
    limited:"Limités",
    next:"Alternative",
    open:"Voir le service",
    reset:"Réinitialiser",
    saver:"Mode économie de données : illustrations allégées.",
  },
  en:{
    eyebrow:"City",
    title:"City services",
    heroKicker:"CITY SERVICES",
    heroTitle:"Your city, your services",
    heroText:"Find all municipal services quickly, see their current availability and access the right actions.",
    search:"Search for a service",
    all:"All",
    cards:"Cards",
    map:"2D map",
    result:"service",
    results:"services",
    empty:"No service matches your search.",
    available:"Available",
    unavailable:"Unavailable",
    limited:"Limited",
    next:"Alternative",
    open:"View service",
    reset:"Reset",
    saver:"Data saver mode: lighter illustrations.",
  },
  mg:{
    eyebrow:"Tanàna",
    title:"Sampan-draharahan'ny tanàna",
    heroKicker:"SAMPAN-DRAHARAHAN'NY TANÀNA",
    heroTitle:"Ny tanànanao, ny sampan-draharahanao",
    heroText:"Jereo haingana eto ireo sampan-draharaha rehetra, ny fahafahany miasa ary ny dingana azo atao.",
    search:"Hitady sampan-draharaha",
    all:"Rehetra",
    cards:"Karatra",
    map:"Sarintany 2D",
    result:"sampan-draharaha",
    results:"sampan-draharaha",
    empty:"Tsy misy sampan-draharaha mifanaraka amin'ny fikarohanao.",
    available:"Azo ampiasaina",
    unavailable:"Tsy azo ampiasaina",
    limited:"Voafetra",
    next:"Safidy hafa",
    open:"Hijery ny sampan-draharaha",
    reset:"Averina",
    saver:"Maody mitsitsy data : nohamafisina ho maivana ny sary.",
  },
};

const NovaTerraMap=lazy(()=>import("../../components/NovaTerraMap/NovaTerraMap.jsx"));

const SERVICE_VISUALS = {
  administration: { skin:"lavender", art:adminArt },
  energie: { skin:"gold", art:energyArt },
  sante: { skin:"sky", art:healthArt },
  habitat: { skin:"mint", art:housingArt },
  housing: { skin:"mint", art:housingArt },
  securite: { skin:"rose", art:safetyArt },
  security: { skin:"rose", art:safetyArt },
  transport: { skin:"ocean", art:null },
  default: { skin:"lavender", art:null },
};

function slugify(value=""){
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim();
}

function serviceVisual(service,index){
  const tokens = [service?.slug, service?.name, service?.category]
    .filter(Boolean)
    .map(slugify)
    .join(" ");
  if(/admin|etat|etat civil|civil registry/.test(tokens)) return SERVICE_VISUALS.administration;
  if(/energie|electric|energy/.test(tokens)) return SERVICE_VISUALS.energie;
  if(/sante|health|medical/.test(tokens)) return SERVICE_VISUALS.sante;
  if(/habitat|housing|logement|residence|residence/.test(tokens)) return SERVICE_VISUALS.habitat;
  if(/securite|security|safety/.test(tokens)) return SERVICE_VISUALS.securite;
  if(/transport|mobilit/.test(tokens)) return SERVICE_VISUALS.transport;
  return index % 2 === 0 ? SERVICE_VISUALS.default : SERVICE_VISUALS.transport;
}

function availabilityVariant(service){
  if (service.isAvailable === false) return "unavailable";
  const text = `${service.availabilityLabel||""} ${service.unavailabilityReason||""}`.toLowerCase();
  if(/limit|reduit|réduit|partiel|partial/.test(text)) return "limited";
  return "available";
}

function availabilityCount(items,variant){
  return items.filter((item)=>availabilityVariant(item)===variant).length;
}

export default function CitizenServices(){
  const [locale]=useLocale();
  const dataProfile=useDataMode();
  const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [availability,setAvailability]=useState("all");
  const [view,setView]=useState(()=>localStorage.getItem("nova_terra_services_view")||(isReducedDataMode()?"cards":"cards"));

  useEffect(()=>{
    let active=true;
    const refresh=()=>getServices({force:true}).then(rows=>active&&setServices(rows)).catch(()=>{});
    getServices().then(rows=>active&&setServices(rows)).catch(()=>active&&setServices([]));
    const onFocus=()=>refresh();
    window.addEventListener("focus",onFocus);
    return()=>{active=false;window.removeEventListener("focus",onFocus)};
  },[locale]);
  useEffect(()=>{if(dataProfile.reduced&&!localStorage.getItem("nova_terra_services_view"))setView("cards")},[dataProfile.reduced]);

  const prepared=useMemo(()=>services.map((service,index)=>{
    const visual=serviceVisual(service,index);
    return {...service, visual, availabilityState: availabilityVariant(service)};
  }),[services]);
  const categories=useMemo(()=>Array.from(new Set(prepared.map(item=>item.category).filter(Boolean))),[prepared]);
  const counts=useMemo(()=>({
    available:availabilityCount(prepared,"available"),
    limited:availabilityCount(prepared,"limited"),
    unavailable:availabilityCount(prepared,"unavailable"),
  }),[prepared]);

  const filtered=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return prepared.filter(service=>{
      const matchesCategory=category==="all"||service.category===category;
      const matchesAvailability=availability==="all"||service.availabilityState===availability;
      const matchesText=!normalized||`${service.name} ${service.category} ${service.shortDescription||""} ${service.description||""} ${service.unavailabilityReason||""}`.toLowerCase().includes(normalized);
      return matchesCategory&&matchesAvailability&&matchesText;
    });
  },[prepared,query,category,availability]);

  const visibleSlugs=useMemo(()=>new Set(filtered.map(item=>item.slug)),[filtered]);
  function changeView(next){setView(next);localStorage.setItem("nova_terra_services_view",next)}

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content citizen-services-page citizen-services-page--immersive">
      <section className="service-catalog-hero">
        <div className="service-catalog-hero__copy">
          <span className="service-catalog-hero__eyebrow">{copy.heroKicker}</span>
          <h2>{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
          {dataProfile.reduced?<small className="service-catalog-hero__hint">{copy.saver}</small>:null}
        </div>
        {!dataProfile.reduced?<div className="service-catalog-hero__art" aria-hidden="true"><img src={cityArt} alt="" loading="eager" decoding="async" fetchPriority="low"/></div>:null}
      </section>

      <section className="services-view-toolbar services-view-toolbar--catalog" aria-label="Affichage et filtres des services">
        <label className="services-search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`${copy.search}${locale==='en' ? ' (e.g. waste, water, permit...)' : ''}`} aria-label={copy.search}/></label>
        <div className="services-category-filters" role="group" aria-label="Filtrer par catégorie"><button type="button" className={category==="all"?"is-active":""} aria-pressed={category==="all"} onClick={()=>setCategory("all")}>{copy.all}</button>{categories.map(item=><button type="button" key={item} className={category===item?"is-active":""} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="services-view-switch" role="group" aria-label="Choisir la vue"><button type="button" className={view==="cards"?"is-active":""} aria-pressed={view==="cards"} onClick={()=>changeView("cards")}><i aria-hidden="true">▦</i><span>{copy.cards}</span></button><button type="button" className={view==="map"?"is-active":""} aria-pressed={view==="map"} onClick={()=>changeView("map")}><i aria-hidden="true">◇</i><span>{copy.map}</span></button></div>
      </section>

      <div className="services-filter-summary services-filter-summary--catalog" aria-live="polite">
        <span>{filtered.length} {filtered.length>1?copy.results:copy.result}</span>
        <div className="service-availability-filters service-availability-filters--legend" role="group" aria-label="Filtrer par disponibilité">
          <button type="button" className={availability==="all"?"is-active":""} onClick={()=>setAvailability("all")}><i className="dot dot-all" aria-hidden="true"/>{copy.all} <b>{prepared.length}</b></button>
          <button type="button" className={`is-ok ${availability==="available"?"is-active":""}`} onClick={()=>setAvailability("available")}><i className="dot dot-ok" aria-hidden="true"/>{copy.available} <b>{counts.available}</b></button>
          <button type="button" className={`is-warn ${availability==="limited"?"is-active":""}`} onClick={()=>setAvailability("limited")}><i className="dot dot-warn" aria-hidden="true"/>{copy.limited} <b>{counts.limited}</b></button>
          <button type="button" className={`is-down ${availability==="unavailable"?"is-active":""}`} onClick={()=>setAvailability("unavailable")}><i className="dot dot-down" aria-hidden="true"/>{copy.unavailable} <b>{counts.unavailable}</b></button>
        </div>
        {(query||category!=="all"||availability!=="all")?<button type="button" onClick={()=>{setQuery("");setCategory("all");setAvailability("all")}}>{copy.reset}</button>:null}
      </div>

      {view==="map"?
        <Suspense fallback={<div className="map-lazy-fallback" role="status">Chargement de la carte 2D…</div>}>
          <NovaTerraMap services={prepared} visibleSlugs={visibleSlugs} locale={locale}/>
        </Suspense>
      :filtered.length?
        <section className="citizen-service-grid citizen-service-grid--catalog">
          {filtered.map(service=><article key={service.slug} className={`citizen-service-card citizen-service-card--immersive service-skin-${service.visual.skin} service-status-${service.availabilityState}`}>
            <div className="citizen-service-card__content">
              <div className="citizen-service-card__toprow">
                <div className="citizen-service-card__icon" aria-hidden="true">{service.icon}</div>
                <div className="citizen-service-card__heading">
                  <span className="citizen-service-card__category">{service.category}</span>
                  <h2>{service.name}</h2>
                </div>
                <ServiceAvailabilityBadge service={service} compact/>
              </div>
              <p>{service.isAvailable===false?(service.unavailabilityReason||"Service temporairement interrompu."):service.shortDescription}</p>
              {service.isAvailable===false&&service.alternativeAction?<small className="citizen-service-card__alternative"><b>{copy.next} :</b> {service.alternativeAction}</small>:null}
              <button className="citizen-service-card__cta" type="button" onClick={()=>navigate(`/citizen/services/${service.slug}`)}><span>{copy.open}</span><i aria-hidden="true">→</i></button>
            </div>
            {!dataProfile.reduced && service.visual.art?<div className="citizen-service-card__art" aria-hidden="true"><img src={service.visual.art} alt="" loading="lazy" decoding="async" fetchPriority="low"/></div>:null}
          </article>)}
        </section>
      :<div className="services-empty-state"><i aria-hidden="true">⌕</i><strong>{copy.empty}</strong></div>}
    </main>
  </div></div>;
}
