import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getServiceCategories, getServices } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function Services() {
  const [services,setServices]=useState([]);
  const [categories,setCategories]=useState(["Tous"]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  useEffect(()=>{Promise.all([getServices(),getServiceCategories()]).then(([s,c])=>{setServices(s);setCategories(c)})},[]);
  const filtered = useMemo(() => services.filter((service) => {
    const matchCategory = category === "Tous" || service.category === category;
    const term = query.trim().toLowerCase();
    const matchQuery = !term || `${service.name} ${service.shortDescription}`.toLowerCase().includes(term);
    return matchCategory && matchQuery;
  }), [services,query, category]);

  return <div className="public-page public-page--services">
    <PublicHeader />
    <main>
      <section className="public-hero public-hero--compact">
        <span className="public-kicker">Services municipaux</span>
        <h1>Tout Nova Terra,<br/><em>au même endroit.</em></h1>
        <p>Horaires, contacts, démarches et informations de chaque service municipal.</p>
        <label className="public-search"><span>⌕</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Rechercher un service..." /></label>
      </section>
      <section className="public-content">
        <div className="filter-row">{categories.map((item)=><button key={item} className={category===item?"is-active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="service-grid">{filtered.map((service)=><article className="service-card" key={service.slug}>
          <div className="service-card__icon">{service.icon}</div><span>{service.category}</span><h2>{service.name}</h2><p>{service.shortDescription}</p>
          <button onClick={()=>navigate(`/services/${service.slug}`)}>Voir le service <b>→</b></button>
        </article>)}</div>
      </section>
    </main><Footer />
  </div>;
}
