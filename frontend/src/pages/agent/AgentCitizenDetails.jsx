import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizen } from "../../api/citizens.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AgentCitizenDetails({params}){
  const [c,setCitizen]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getCitizen(params.id).then(data=>{if(!mounted)return;if(!data)setError('Citoyen introuvable dans les demandes accessibles.');else setCitizen(data)}).catch(()=>mounted&&setError('Impossible de charger le citoyen.')).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[params.id]);
  if(loading)return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Fiche citoyen" title="Chargement"/><main className="portal-content"><div className="loading-card">Chargement…</div></main></div></div>;
  if(error||!c)return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Fiche citoyen" title="Citoyen"/><main className="portal-content"><div className="error-card">{error}</div></main></div></div>;
  const initials=c.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main"><PortalTopbar eyebrow="Fiche citoyen" title={c.name}/><main className="portal-content"><button className="back-link" onClick={()=>navigate('/agent/citizens')}>← Retour aux citoyens</button><section className="profile-hero"><div className="profile-avatar">{initials}</div><div><span>Compte #{c.id}</span><h2>{c.name}</h2><p>{c.email||'E-mail non disponible'} · {c.status}</p></div><div className="profile-progress"><b>{c.requests}</b><span>demandes</span></div></section><section className="portal-grid portal-grid--2"><article className="portal-card"><span className="section-label">Coordonnées</span><h3>Contact</h3><div className="detail-list"><div><span>Email</span><b>{c.email||'—'}</b></div><div><span>Téléphone</span><b>—</b></div><div><span>Adresse</span><b>Non exposée par l’API</b></div></div></article><article className="portal-card"><span className="section-label">Historique</span><h3>Demandes récentes</h3>{c.requestItems.length?c.requestItems.map(r=><button className="citizen-request-link" key={r.ref} onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref)}`)}><span>{r.ref}</span><strong>{r.service}</strong><em>{r.status}</em></button>):<p className="detail-copy">Aucune demande accessible.</p>}</article></section></main></div></div>;
}
