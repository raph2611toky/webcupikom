import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getCitizenDashboard } from "../../api/dashboards.js";
import { getCitizenRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getNews } from "../../api/news.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function profileCompletion(user) {
  const fields = [user?.first_name, user?.last_name, user?.email, user?.phone_number, user?.locale];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function CitizenDashboard(){
  const { user } = useAuth();
  const [summary,setSummary]=useState(null),[requests,setRequests]=useState([]),[services,setServices]=useState([]),[news,setNews]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");

  useEffect(()=>{let mounted=true;Promise.all([getCitizenDashboard(),getCitizenRequests(),getServices(),getNews()]).then(([d,r,s,n])=>{if(!mounted)return;setSummary(d);setRequests(r);setServices(s);setNews(n)}).catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger votre espace citoyen."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);

  const active=useMemo(()=>requests.filter(r=>r.statusCode!=="completed"),[requests]);
  const stats=summary?.requests||{};
  const inProgress=(stats.pending||0)+(stats.submitted||0)+(stats.in_progress||0);
  const completion=profileCompletion(user);

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Espace citoyen" title={`Bonjour ${user?.first_name || user?.display_name || "Citoyen"} 👋`} actions={<button className="topbar-cta" onClick={()=>navigate('/citizen/requests')}>Nouvelle demande</button>}/><main className="portal-content">
    {loading?<div className="loading-card">Chargement de votre espace…</div>:null}{error?<div className="error-card">{error}</div>:null}
    {!loading&&!error?<>
    <section className="welcome-banner"><div><span>Bienvenue dans votre espace Terra Nova</span><h2>Tout ce qui compte,<br/>sans perdre le fil.</h2><p>Suivez vos démarches, vos messages et les informations importantes de la ville.</p></div><div className="welcome-banner__orb"><i/><b>{completion}%</b><span>profil complété</span></div></section>
    <section className="metric-grid"><article><span>Démarches en cours</span><strong>{inProgress}</strong><small>Demandes actives</small></article><article><span>Action requise</span><strong>{stats.action_required||0}</strong><small>À compléter</small></article><article><span>Notifications</span><strong>{summary?.notifications_unread||0}</strong><small>Non lues</small></article><article><span>Messages mairie</span><strong>{summary?.contacts||0}</strong><small>Historique disponible</small></article></section>
    <section className="portal-grid portal-grid--2"><article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Mes démarches</span><h3>À suivre maintenant</h3></div><button onClick={()=>navigate('/citizen/requests')}>Tout voir →</button></div><div className="request-stack">{active.slice(0,3).map(r=><button key={r.id} onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(r.id)}`)}><div><span>{r.id}</span><strong>{r.title}</strong><small>{r.service} · {r.updated}</small></div><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></button>)}{active.length===0?<p className="detail-copy">Aucune démarche active.</p>:null}</div></article>
      <article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Services rapides</span><h3>Accès direct</h3></div><button onClick={()=>navigate('/citizen/services')}>Explorer →</button></div><div className="quick-services">{services.slice(0,6).map(s=><button key={s.slug} onClick={()=>navigate(`/services/${s.slug}`)}><i>{s.icon}</i><span>{s.name}</span></button>)}</div></article></section>
    <section className="portal-grid portal-grid--2"><article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Informations importantes</span><h3>À retenir aujourd’hui</h3></div></div><div className="notice-list">{news.slice(0,2).map((item,index)=><div key={item.slug} className={`notice ${index===0?'notice--purple':''}`}><b>{item.title}</b><span>{item.excerpt}</span></div>)}{news.length===0?<p className="detail-copy">Aucune information publiée.</p>:null}</div></article>
      <article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Mes échanges</span><h3>Mairie & notifications</h3></div></div><div className="admin-shortcuts"><button onClick={()=>navigate('/citizen/messages')}><i>✉</i><div><b>Messages envoyés</b><span>{summary?.contacts||0} message(s)</span></div><em>→</em></button><button onClick={()=>navigate('/citizen/notifications')}><i>◌</i><div><b>Notifications</b><span>{summary?.notifications_unread||0} non lue(s)</span></div><em>→</em></button></div></article></section>
    <section className="help-banner"><div><span>Besoin d’aide ?</span><h3>Un service municipal peut vous accompagner.</h3></div><button onClick={()=>navigate('/contact')}>Contacter la ville →</button></section>
    </>:null}
  </main></div></div>;
}
