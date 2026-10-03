import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getService } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function ServiceDetails({ params }) {
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getService(params.slug)
      .then((data) => mounted && setService(data))
      .catch(() => mounted && setError("Service introuvable."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [params.slug]);

  if (loading) return <div className="public-page"><PublicHeader/><main className="public-content"><div className="loading-card">Chargement…</div></main><Footer/></div>;
  if (error || !service) return <div className="public-page"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>Service introuvable</h1><button className="primary-button" onClick={()=>navigate('/services')}>Retour aux services</button></div></main><Footer/></div>;

  return <div className="public-page">
    <PublicHeader />
    <main>
      <section className="service-detail-hero">
        <button className="text-link" onClick={()=>navigate('/services')}>← Tous les services</button>
        <div className="service-detail-hero__icon">{service.icon}</div>
        <span>{service.category}</span>
        <h1>{service.name}</h1>
        <p>{service.description}</p>
        <button className="primary-button" onClick={()=>navigate('/login?next=/citizen/requests')}>Faire une demande</button>
      </section>
      <section className="service-detail-grid public-content">
        <article className="info-panel info-panel--large"><span className="panel-kicker">Démarches</span><h2>Ce que vous pouvez faire</h2><div className="action-list">{service.actions.length ? service.actions.map((item,i)=><div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span><i>→</i></div>) : <p>Les démarches seront proposées depuis votre espace citoyen.</p>}</div></article>
        <article className="info-panel"><span className="panel-kicker">Horaires</span><h3>{service.openingHours || "—"}</h3><p>{service.address || "—"}</p></article>
        <article className="info-panel"><span className="panel-kicker">Coordonnées</span><h3>{service.phone || "—"}</h3><p>{service.email || "—"}</p></article>
        <article className="info-panel info-panel--large"><span className="panel-kicker">Documents nécessaires</span><h2>Préparez votre dossier</h2>{service.requiredDocuments.length ? <ul>{service.requiredDocuments.map(item=><li key={item}>{item}</li>)}</ul> : <p>Aucun document spécifique indiqué.</p>}</article>
        <article className="info-panel info-panel--large"><span className="panel-kicker">Questions fréquentes</span><h2>Besoin de précisions ?</h2><div className="faq-list">{service.faq.length ? service.faq.map(item=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>) : <p>Contactez le service pour plus d’informations.</p>}</div></article>
      </section>
    </main>
    <Footer />
  </div>;
}
