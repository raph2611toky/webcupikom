import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { currentCitizen } from "../../data/mockData.js";
import { getCitizenRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenDashboard(){
  const [citizenRequests,setCitizenRequests]=useState([]);
  const [services,setServices]=useState([]);
  const [news,setNews]=useState([]);

  const load = async () => {
    const [requestsData, servicesData, newsData] = await Promise.all([
      getCitizenRequests(),
      getServices(),
      getNews(),
    ]);
    setCitizenRequests(requestsData);
    setServices(servicesData);
    setNews(newsData);
  };

  useEffect(()=>{
    load();
    const refresh=()=>load();
    window.addEventListener("terra-news-updated",refresh);
    window.addEventListener("terra-services-updated",refresh);
    return ()=>{
      window.removeEventListener("terra-news-updated",refresh);
      window.removeEventListener("terra-services-updated",refresh);
    };
  },[]);

  const active=useMemo(()=>citizenRequests.filter(r=>r.status!=="Terminée"),[citizenRequests]);
  const actions=useMemo(()=>citizenRequests.filter(r=>r.status==="Action requise").length,[citizenRequests]);

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar
        eyebrow="Espace citoyen"
        title={`Bonjour ${currentCitizen.firstName} 👋`}
        actions={<>
          <button className="topbar-ghost" onClick={()=>navigate("/citizen/news")}>Actualités</button>
          <button className="topbar-cta" onClick={()=>navigate('/citizen/requests?new=1&type=signalement')}>Nouvelle demande</button>
        </>}
      />
      <main className="portal-content citizen-dashboard">
        <section className="welcome-banner welcome-banner--compact">
          <div>
            <span>Votre espace Nova Terra</span>
            <h2>Votre ville,<br/>en un coup d’œil.</h2>
            <p>Suivez vos démarches et accédez aux services utiles sans chercher partout.</p>
          </div>
          <div className="welcome-banner__orb"><i/><b>{currentCitizen.profileCompletion}%</b><span>profil complété</span></div>
        </section>

        <section className="metric-grid metric-grid--3">
          <article><span>Démarches en cours</span><strong>{active.length}</strong><small>À suivre</small></article>
          <article><span>Action requise</span><strong>{actions}</strong><small>À compléter</small></article>
          <article><span>Actualités</span><strong>{news.length}</strong><small>Publications disponibles</small></article>
        </section>

        <section className="portal-grid portal-grid--2 citizen-dashboard__main">
          <article className="portal-card">
            <div className="portal-card__head">
              <div><span className="section-label">Mes démarches</span><h3>À suivre maintenant</h3></div>
              <button onClick={()=>navigate('/citizen/requests')}>Tout voir →</button>
            </div>
            <div className="request-stack">
              {active.slice(0,3).map(r=><button key={r.id} onClick={()=>navigate(`/citizen/requests/${r.id}`)}>
                <div><span>{r.id}</span><strong>{r.title}</strong><small>{r.service} · {r.updated}</small></div>
                <em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em>
              </button>)}
              {!active.length ? <div className="dashboard-empty">Aucune démarche en cours.</div> : null}
            </div>
          </article>

          <article className="portal-card">
            <div className="portal-card__head">
              <div><span className="section-label">Services municipaux</span><h3>Accès rapide</h3></div>
              <button onClick={()=>navigate('/citizen/services')}>Tous les services →</button>
            </div>
            <div className="quick-services quick-services--compact">
              {services.slice(0,6).map(s=><button key={s.slug} onClick={()=>navigate(`/services/${s.slug}`)}>
                <i>{s.icon}</i><span>{s.name}</span>
              </button>)}
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>;
}
