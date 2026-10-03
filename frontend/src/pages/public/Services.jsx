import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getServiceCategories, getServices } from "../../api/services.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const COPY={
  fr:{kicker:"Services municipaux",title:<>Tout Nova Terra,<br/><em>au même endroit.</em></>,intro:"Horaires, contacts, démarches et informations de chaque service municipal.",search:"Rechercher un service...",all:"Tous",open:"Voir le service"},
  en:{kicker:"City services",title:<>All Nova Terra,<br/><em>in one place.</em></>,intro:"Opening hours, contacts, procedures and useful information for every city service.",search:"Search a service...",all:"All",open:"View service"},
  mg:{kicker:"Sampan-draharahan'ny tanàna",title:<>Nova Terra manontolo,<br/><em>amin'ny toerana iray.</em></>,intro:"Ora fiasana, fifandraisana, dingana ary vaovao ilaina momba ny sampan-draharaha tsirairay.",search:"Hitady sampan-draharaha...",all:"Rehetra",open:"Hijery ny sampan-draharaha"},
};

export default function Services() {
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [services,setServices]=useState([]);
  const [categories,setCategories]=useState(["Tous"]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("Tous");

  useEffect(()=>{
    setCategory("Tous");
    Promise.all([getServices(),getServiceCategories()]).then(([s,c])=>{setServices(s);setCategories(c)});
  },[locale]);

  const filtered=useMemo(()=>services.filter((service)=>{
    const matchCategory=category==="Tous"||service.category===category;
    const term=query.trim().toLowerCase();
    const matchQuery=!term||`${service.name} ${service.shortDescription}`.toLowerCase().includes(term);
    return matchCategory&&matchQuery;
  }),[services,query,category]);

  return <div className="public-page public-page--services">
    <PublicHeader/>
    <main>
      <section className="public-hero public-hero--compact">
        <span className="public-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <label className="public-search"><span aria-hidden="true">⌕</span><input aria-label={copy.search} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={copy.search}/></label>
      </section>
      <section className="public-content">
        <div className="filter-row">{categories.map((item)=><button key={item} className={category===item?"is-active":""} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item==="Tous"?copy.all:item}</button>)}</div>
        <div className="service-grid">{filtered.map((service)=><article className="service-card" key={service.slug}>
          <div className="service-card__icon" aria-hidden="true">{service.icon}</div><span>{service.category}</span><h2>{service.name}</h2><p>{service.shortDescription}</p>
          <button onClick={()=>navigate(`/services/${service.slug}`)}>{copy.open} <b>→</b></button>
        </article>)}</div>
      </section>
    </main><Footer/>
  </div>;
}
