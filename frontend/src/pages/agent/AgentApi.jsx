import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getWebcupFeed } from "../../api/webcup.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AgentApi(){
  const[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(force=false){setLoading(true);setError('');try{setData(await getWebcupFeed({force}))}catch(e){setError(e?.response?.data?.detail||e.message||'Impossible de charger le flux.')}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);const s=data?.session||{};
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="24H By WebCup" title="Flux Terra Nova" actions={<button className="topbar-cta" onClick={()=>load(true)}>Actualiser</button>}/><main className="portal-content">{loading?<div className="loading-card">Connexion au flux…</div>:error?<div className="error-card">{error}</div>:<><section className="api-status"><div><i/><span>Session {s.status||'active'}</span><small>Source : {data.source==='live'?'backend synchronisé avec l’API officielle':'cache backend'}</small></div><strong>Vague {s.current_wave??0}</strong></section><section className="metric-grid"><article><span>Vague actuelle</span><strong>{s.current_wave??0}</strong></article><article><span>Demandes visibles</span><strong>{s.visible_requests_count??data.requests?.length??0}</strong></article><article><span>Prochaine vague</span><strong>{s.next_wave_number??'—'}</strong></article><article><span>Temps restant</span><strong>{s.minutes_until_next_wave??'—'}<small> min</small></strong></article></section><section className="portal-card"><div className="portal-card__head"><div><span className="section-label">Demandes disponibles</span><h3>Flux actuel</h3></div></div><div className="api-request-list">{(data.requests||[]).map((r,i)=><article key={r.request_code||i}><div className="api-request-code">{r.request_code}</div><div><span>{r.requester_name||'Terra Nova'}</span><strong>{r.message_public}</strong></div><em>{r.difficulty||'—'}</em><b>{r.xp_available??r.xp_total??'—'} XP</b></article>)}</div></section></>}</main></div></div>;
}
