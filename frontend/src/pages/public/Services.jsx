import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getServiceCategories, getServices } from "../../api/services.js";
import { getLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function Services() {
  const [services,setServices]=useState([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("Tous");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const locale=getLocale();

  useEffect(()=>{
    let mounted=true;
    getServices()
      .then(data=>mounted&&setServices(data))
      .catch(()=>mounted&&setError(locale==="en"?"Unable to load city services.":"Impossible de charger les services municipaux."))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[locale]);

  const categories=useMemo(()=>getServiceCategories(services),[services]);
  const filtered=useMemo(()=>services.filter(service=>{
    const matchCategory=category==="Tous"||service.category===category;
    const term=query.trim().toLowerCase();
    const matchQuery=!term||`${service.name} ${service.shortDescription}`.toLowerCase().includes(term);
    return matchCategory&&matchQuery;
  }),[services,query,category]);

  return <div className="public-page public-page--services">
    <PublicHeader/>
    <main>
      <section className="public-hero public-hero--compact">
        <span className="public-kicker">{locale==="en"?"CITY SERVICES":"SERVICES MUNICIPAUX"}</span>
        <h1>{locale==="en"?<>All Nova Terra,<br/><em>in one place.</em></>:<>Tout Nova Terra,<br/><em>au même endroit.</em></>}</h1>
        <p>{locale==="en"?"Opening hours, contacts, procedures and useful information for each city service.":"Horaires, contacts, démarches et informations de chaque service municipal."}</p>
        <label className="public-search"><span aria-hidden="true">⌕</span><input aria-label={locale==="en"?"Search a service":"Rechercher un service"} value={query} onChange={e=>setQuery(e.target.value)} placeholder={locale==="en"?"Search a service...":"Rechercher un service..."}/></label>
      </section>

      <section className="public-content">
        {loading?<div className="loading-card">{locale==="en"?"Loading services...":"Chargement des services..."}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}
        {!loading&&!error?<>
          <div className="filter-row">{categories.map(item=><button key={item} className={category===item?"is-active":""} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
          <div className="service-grid">{filtered.map(service=><article className="service-card" key={service.slug}>
            <div className="service-card__icon" aria-hidden="true">{service.icon}</div>
            <span>{service.category}</span><h2>{service.name}</h2><p>{service.shortDescription}</p>
            <button onClick={()=>navigate(`/services/${service.slug}`)}>{locale==="en"?"View service":"Voir le service"} <b>→</b></button>
          </article>)}</div>
        </>:null}
      </section>
    </main>
    <Footer/>
  </div>;
}
