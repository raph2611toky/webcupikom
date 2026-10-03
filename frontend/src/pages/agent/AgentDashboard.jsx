import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequests } from "../../api/requests.js";
import { getNews } from "../../api/news.js";
import { getServices } from "../../api/services.js";
import { navigate } from "../../utils/navigation.js";
import { getAgentAppointmentSummary } from "../../api/appointments.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentDashboard(){
  const [agentRequests,setAgentRequests]=useState([]);
  const [newsCount,setNewsCount]=useState(0);
  const [serviceCount,setServiceCount]=useState(0);
  const [appointmentCount,setAppointmentCount]=useState(0);

  useEffect(()=>{
    Promise.all([getAgentRequests(),getNews(),getServices(),getAgentAppointmentSummary()])
      .then(([requests,publications,services,appointmentSummary])=>{
        setAgentRequests(requests);
        setNewsCount(publications.length);
        setServiceCount(services.length);
        setAppointmentCount(Number(appointmentSummary?.upcoming ?? appointmentSummary?.confirmed ?? 0));
      });
  },[]);

  const toProcess=agentRequests.filter(r=>r.status==="À traiter").length;
  const processing=agentRequests.filter(r=>r.status==="En traitement").length;
  const reportCount=agentRequests.filter(r=>r.requestType==="signalement" && r.status!=="Terminée").length;

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Centre opérationnel" title="Tableau de bord agent" actions={<button className="topbar-cta" onClick={()=>navigate('/agent/requests')}>Voir les demandes</button>}/>
    <main className="portal-content agent-dashboard">
      <section className="metric-grid metric-grid--3">
        <article><span>Demandes reçues</span><strong>{agentRequests.length}</strong><small>File citoyenne</small></article>
        <article><span>À traiter</span><strong>{toProcess}</strong><small>À prendre en charge</small></article>
        <article><span>En traitement</span><strong>{processing}</strong><small>Dossiers actifs</small></article>
      </section>

      <section className="portal-grid portal-grid--2 agent-dashboard__main">
        <article className="portal-card">
          <div className="portal-card__head">
            <div><span className="section-label">Demandes prioritaires</span><h3>À traiter maintenant</h3></div>
            <button onClick={()=>navigate('/agent/requests')}>Tout voir →</button>
          </div>
          <div className="agent-queue">
            {agentRequests.slice(0,5).map(r=><button key={r.ref} onClick={()=>navigate(`/agent/requests/${r.ref}`)}>
              <span className="mono">{r.ref}</span>
              <div><strong>{r.citizen}</strong><small>{r.service} · {r.created}</small></div>
              <em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em>
            </button>)}
          </div>
        </article>

        <article className="portal-card">
          <div className="portal-card__head">
            <div><span className="section-label">Gestion de la ville</span><h3>Contenus utiles aux habitants</h3></div>
          </div>
          <div className="agent-management">
            <button onClick={()=>navigate('/agent/news')}>
              <i>▤</i><div><b>Publications municipales</b><span>{newsCount} publications · annonces et informations pratiques</span></div><em>→</em>
            </button>
            <button onClick={()=>navigate('/agent/services')}>
              <i>◇</i><div><b>Services municipaux</b><span>{serviceCount} services · horaires, contacts et démarches</span></div><em>→</em>
            </button>
            <button onClick={()=>navigate('/agent/signalements')}>
              <i>!</i><div><b>Signalements terrain</b><span>{reportCount} signalements à suivre</span></div><em>→</em>
            </button>
            <button onClick={()=>navigate('/agent/appointments')}>
              <i>◷</i><div><b>Rendez-vous citoyens</b><span>{appointmentCount} rendez-vous à venir ou arrivés</span></div><em>→</em>
            </button>
            <button onClick={()=>navigate('/agent/api')}>
              <i>⌘</i><div><b>Flux WebCup</b><span>Suivre les nouvelles demandes du concours</span></div><em>→</em>
            </button>
          </div>
        </article>
      </section>
    </main>
  </div></div>;
}
