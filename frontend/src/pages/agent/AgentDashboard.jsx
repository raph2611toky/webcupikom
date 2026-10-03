import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequests } from "../../api/requests.js";
import { getWebcupFeed } from "../../api/webcup.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentDashboard(){
  const [requests,setRequests]=useState([]),[feed,setFeed]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;Promise.all([getAgentRequests(),getWebcupFeed()]).then(([r,f])=>{if(!mounted)return;setRequests(r);setFeed(f)}).catch(()=>mounted&&setError("Impossible de charger le tableau de bord agent.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const pending=requests.filter(r=>r.statusCode==="pending").length;
  const processing=requests.filter(r=>r.statusCode==="in_progress").length;
  const completed=requests.filter(r=>r.statusCode==="completed").length;
  const session=feed?.session||{};
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Centre opérationnel" title="Tableau de bord agent" actions={<button className="topbar-cta" onClick={()=>navigate('/agent/requests')}>Voir les demandes</button>}/><main className="portal-content">
    {loading?<div className="loading-card">Chargement…</div>:null}{error?<div className="error-card">{error}</div>:null}
    {!loading&&!error?<><section className="metric-grid"><article><span>Demandes reçues</span><strong>{requests.length}</strong><small>Total actuel</small></article><article><span>À traiter</span><strong>{pending}</strong><small>Priorité active</small></article><article><span>En traitement</span><strong>{processing}</strong><small>Par les services</small></article><article><span>Terminées</span><strong>{completed}</strong><small>Clôturées</small></article></section><section className="portal-grid portal-grid--2"><article className="portal-card"><div className="portal-card__head"><div><span className="section-label">Demandes à traiter</span><h3>File prioritaire</h3></div><button onClick={()=>navigate('/agent/requests')}>Tout voir →</button></div><div className="agent-queue">{requests.filter(r=>r.statusCode!=="completed").slice(0,4).map(r=><button key={r.ref} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref)}`)}><span className="mono">{r.ref}</span><div><strong>{r.citizen}</strong><small>{r.service} · {r.created}</small></div><em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em></button>)}</div></article><article className="portal-card"><span className="section-label">Flux WebCup</span><h3>Session {session.status||'—'}</h3><div className="webcup-snapshot"><div><span>Vague actuelle</span><strong>{session.current_wave??0}</strong></div><div><span>Demandes visibles</span><strong>{session.visible_requests_count??feed?.requests?.length??0}</strong></div><div><span>Prochaine vague</span><strong>{session.next_wave_number??'—'}</strong></div><div><span>Temps restant</span><strong>{session.minutes_until_next_wave??'—'} min</strong></div></div><button className="primary-action" onClick={()=>navigate('/agent/api')}>Ouvrir le flux →</button></article></section><section className="portal-card"><div className="portal-card__head"><div><span className="section-label">Activité récente</span><h3>Dernières mises à jour</h3></div></div><div className="activity-feed">{requests.slice(0,3).map(r=><div key={r.ref}><i>●</i><div><b>{r.ref} · {r.status}</b><span>{r.updated}</span></div></div>)}{requests.length===0?<p className="detail-copy">Aucune demande pour le moment.</p>:null}</div></section></>:null}
  </main></div></div>;
}
