import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getServiceCategories, getServices } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function Services() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getServices()
      .then((data) => mounted && setItems(data))
      .catch(() => mounted && setError("Impossible de charger les services municipaux."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const categories = useMemo(() => getServiceCategories(items), [items]);
  const filtered = useMemo(() => items.filter((service) => {
    const matchCategory = category === "Tous" || service.category === category;
    const term = query.trim().toLowerCase();
    const matchQuery = !term || `${service.name} ${service.shortDescription}`.toLowerCase().includes(term);
    return matchCategory && matchQuery;
  }), [items, query, category]);

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
        {loading ? <div className="loading-card">Chargement des services…</div> : null}
        {error ? <div className="error-card">{error}</div> : null}
        {!loading && !error ? <>
          <div className="filter-row">{categories.map((item)=><button key={item} className={category===item?"is-active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
          <div className="service-grid">{filtered.map((service)=><article className="service-card" key={service.slug}>
            <div className="service-card__icon">{service.icon}</div>
            <span>{service.category}</span>
            <h2>{service.name}</h2>
            <p>{service.shortDescription}</p>
            <button onClick={()=>navigate(`/services/${service.slug}`)}>Voir le service <b>→</b></button>
          </article>)}</div>
        </> : null}
      </section>
    </main>
    <Footer />
  </div>;
}
