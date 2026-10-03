import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentDashboard } from "../../api/dashboards.js";
import { getAgentRequests } from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentDashboard(){
  const [dashboard,setDashboard]=useState(null);
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    Promise.all([getAgentDashboard(),getAgentRequests()])
      .then(([d,r])=>{if(!mounted)return;setDashboard(d);setRequests(r)})
      .catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger le tableau de bord agent.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[]);

  const stats=dashboard?.requests||{};
  const toProcess=(stats.pending||0)+(stats.submitted||0);
  const session=dashboard?.webcup?.session||{};

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Centre opérationnel" title="Tableau de bord agent" actions={<button className="topbar-cta" onClick={()=>navigate("/agent/requests")}>Voir les demandes</button>}/>
      <main className="portal-content agent-dashboard">
        {loading?<div className="loading-card">Chargement…</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}

        {!loading&&!error?<>
          <section className="metric-grid metric-grid--3">
            <article><span>Demandes reçues</span><strong>{stats.total??requests.length}</strong><small>File citoyenne</small></article>
            <article><span>À traiter</span><strong>{toProcess}</strong><small>Encore sans prise en charge</small></article>
            <article><span>En traitement</span><strong>{stats.in_progress||0}</strong><small>Dossiers actifs</small></article>
          </section>

          <section className="portal-grid portal-grid--2 agent-dashboard__main">
            <article className="portal-card">
              <div className="portal-card__head">
                <div><span className="section-label">Demandes prioritaires</span><h3>À traiter maintenant</h3></div>
                <button onClick={()=>navigate("/agent/requests")}>Tout voir →</button>
              </div>
              <div className="agent-queue">
                {requests.filter(r=>r.statusCode!=="completed").slice(0,5).map(r=><button key={r.ref} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref)}`)}>
                  <span className="mono">{r.ref}</span>
                  <div><strong>{r.citizen}</strong><small>{r.service} · {r.created}</small></div>
                  <em className={`status-pill status-${String(r.status).replaceAll(" ","-").toLowerCase()}`}>{r.status}</em>
                </button>)}
                {!requests.length?<div className="dashboard-empty">Aucune demande.</div>:null}
              </div>
            </article>

            <article className="portal-card">
              <div className="portal-card__head"><div><span className="section-label">Activité municipale</span><h3>Accès opérationnels</h3></div></div>
              <div className="agent-management">
                <button onClick={()=>navigate("/agent/messages")}><i>✉</i><div><b>Messages citoyens</b><span>{dashboard?.contacts_unread||0} message(s) non lu(s)</span></div><em>→</em></button>
                <button onClick={()=>navigate("/agent/citizens")}><i>◉</i><div><b>Citoyens</b><span>{dashboard?.citizens||0} compte(s) citoyen</span></div><em>→</em></button>
                <button onClick={()=>navigate("/agent/api")}><i>⌘</i><div><b>Flux WebCup</b><span>Vague {session.current_wave??0} · {session.visible_requests_count??0} demandes visibles</span></div><em>→</em></button>
              </div>
            </article>
          </section>
        </>:null}
      </main>
    </div>
  </div>;
}
