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
  const [dashboard,setDashboard]=useState(null),[requests,setRequests]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;Promise.all([getAgentDashboard(),getAgentRequests()]).then(([d,r])=>{if(!mounted)return;setDashboard(d);setRequests(r)}).catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger le tableau de bord agent."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const stats=dashboard?.requests||{};
  const session=dashboard?.webcup?.session||{};
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Centre opérationnel" title="Tableau de bord agent" actions={<button className="topbar-cta" onClick={()=>navigate('/agent/requests')}>Voir les demandes</button>}/><main className="portal-content">
    {loading?<div className="loading-card">Chargement…</div>:null}{error?<div className="error-card">{error}</div>:null}
    {!loading&&!error?<><section className="metric-grid"><article><span>Demandes reçues</span><strong>{stats.total||0}</strong><small>Total actuel</small></article><article><span>À traiter</span><strong>{(stats.pending||0)+(stats.submitted||0)}</strong><small>Priorité active</small></article><article><span>En traitement</span><strong>{stats.in_progress||0}</strong><small>Par les services</small></article><article><span>Messages non lus</span><strong>{dashboard?.contacts_unread||0}</strong><small>Relations citoyennes</small></article></section>
    <section className="portal-grid portal-grid--2"><article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Demandes à traiter</span><h3>File prioritaire</h3></div><button onClick={()=>navigate('/agent/requests')}>Tout voir →</button></div><div className="agent-queue">{requests.filter(r=>r.statusCode!=="completed").slice(0,4).map(r=><button key={r.ref} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref)}`)}><span className="mono">{r.ref}</span><div><strong>{r.citizen}</strong><small>{r.service} · {r.created}</small></div><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></button>)}{requests.length===0?<p className="detail-copy">Aucune demande pour le moment.</p>:null}</div></article>
      <article className="portal-card"><span className="section-label">Flux WebCup</span><h3>Session {session.status||'—'}</h3><div className="webcup-snapshot"><div><span>Vague actuelle</span><strong>{session.current_wave??0}</strong></div><div><span>Demandes visibles</span><strong>{session.visible_requests_count??0}</strong></div><div><span>Prochaine vague</span><strong>{session.next_wave_number??'—'}</strong></div><div><span>Temps restant</span><strong>{session.minutes_until_next_wave??'—'} min</strong></div></div><button className="primary-action" onClick={()=>navigate('/agent/api')}>Ouvrir le flux →</button></article></section>
    <section className="portal-grid portal-grid--2"><article className="portal-card"><span className="section-label">Population</span><h3>{dashboard?.citizens||0} citoyens</h3><p className="detail-copy">Annuaire citoyen connecté directement au backend opérationnel.</p><button className="primary-action" onClick={()=>navigate('/agent/citizens')}>Voir les citoyens →</button></article><article className="portal-card"><span className="section-label">Relations citoyennes</span><h3>{dashboard?.contacts_unread||0} message(s) à lire</h3><p className="detail-copy">Les messages du formulaire Contact arrivent ici, sans envoi d'e-mail externe.</p><button className="primary-action" onClick={()=>navigate('/agent/messages')}>Ouvrir les messages →</button></article></section></>:null}
  </main></div></div>;
}
