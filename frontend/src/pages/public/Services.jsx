import { useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { serviceCategories, services } from "../../data/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function Services() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  const filtered = useMemo(() => services.filter((service) => {
    const matchCategory = category === "Tous" || service.category === category;
    const term = query.trim().toLowerCase();
    const matchQuery = !term || `${service.name} ${service.shortDescription}`.toLowerCase().includes(term);
    return matchCategory && matchQuery;
  }), [query, category]);

  return <div className="public-page">
    <PublicHeader />
    <main>
      <section className="public-hero public-hero--compact">
        <span className="public-kicker">Services municipaux</span>
        <h1>Tout Terra Nova,<br/><em>au même endroit.</em></h1>
        <p>Trouvez rapidement le service adapté à votre besoin, consultez les informations utiles et lancez vos démarches.</p>
        <label className="public-search"><span>⌕</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Rechercher un service..." /></label>
      </section>
      <section className="public-content">
        <div className="filter-row">{serviceCategories.map((item)=><button key={item} className={category===item?"is-active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="service-grid">{filtered.map((service)=><article className="service-card" key={service.slug}>
          <div className="service-card__icon">{service.icon}</div>
          <span>{service.category}</span>
          <h2>{service.name}</h2>
          <p>{service.shortDescription}</p>
          <button onClick={()=>navigate(`/services/${service.slug}`)}>Voir le service <b>→</b></button>
        </article>)}</div>
      </section>
    </main>
    <Footer />
  </div>;
}
