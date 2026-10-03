import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { currentCitizen, citizenRequests } from "../../data/mockData.js";
import { services } from "../../data/services.js";
import { news } from "../../data/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenDashboard(){
  const active=citizenRequests.filter(r=>r.status!=="Terminée");
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Espace citoyen" title={`Bonjour ${currentCitizen.firstName} 👋`} actions={<button className="topbar-cta" onClick={()=>navigate('/citizen/requests')}>Nouvelle demande</button>}/><main className="portal-content">
    <section className="welcome-banner"><div><span>Bienvenue dans votre espace Terra Nova</span><h2>Tout ce qui compte,<br/>sans perdre le fil.</h2><p>Suivez vos démarches, retrouvez vos services et recevez les informations importantes de votre secteur.</p></div><div className="welcome-banner__orb"><i/><b>{currentCitizen.profileCompletion}%</b><span>profil complété</span></div></section>
    <section className="metric-grid"><article><span>Démarches en cours</span><strong>2</strong><small>+1 cette semaine</small></article><article><span>Action requise</span><strong>1</strong><small>Document à compléter</small></article><article><span>Terminées</span><strong>8</strong><small>Depuis votre inscription</small></article><article><span>Notifications</span><strong>2</strong><small>Non lues</small></article></section>
    <section className="portal-grid portal-grid--2"><article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Mes démarches</span><h3>À suivre maintenant</h3></div><button onClick={()=>navigate('/citizen/requests')}>Tout voir →</button></div><div className="request-stack">{active.slice(0,3).map(r=><button key={r.id} onClick={()=>navigate(`/citizen/requests/${r.id}`)}><div><span>{r.id}</span><strong>{r.title}</strong><small>{r.service} · {r.updated}</small></div><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></button>)}</div></article>
      <article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Services rapides</span><h3>Accès direct</h3></div><button onClick={()=>navigate('/citizen/services')}>Explorer →</button></div><div className="quick-services">{services.slice(0,6).map(s=><button key={s.slug} onClick={()=>navigate(`/services/${s.slug}`)}><i>{s.icon}</i><span>{s.name}</span></button>)}</div></article></section>
    <section className="portal-grid portal-grid--2"><article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Informations importantes</span><h3>À retenir aujourd’hui</h3></div></div><div className="notice-list"><div className="notice notice--purple"><b>Maintenance Helios</b><span>Micro-coupures possibles entre 14:00 et 15:30.</span></div><div className="notice"><b>Ligne N7</b><span>La nouvelle navette Astra ↔ Kepler est en service.</span></div></div></article>
      <article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Dernières actualités</span><h3>Dans votre ville</h3></div><button onClick={()=>navigate('/news')}>Journal →</button></div><div className="mini-news">{news.slice(0,3).map(n=><button key={n.slug} onClick={()=>navigate(`/news/${n.slug}`)}><span>{n.category}</span><strong>{n.title}</strong><small>{n.date}</small></button>)}</div></article></section>
    <section className="help-banner"><div><span>Besoin d’aide ?</span><h3>Un service municipal peut vous accompagner.</h3></div><button onClick={()=>navigate('/contact')}>Contacter la ville →</button></section>
  </main></div></div>;
}
