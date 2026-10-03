import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequests } from "../../api/requests.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AdminUsers(){
  const [items,setItems]=useState([]),[q,setQ]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getAgentRequests().then(requests=>{if(!mounted)return;const map=new Map();requests.forEach(r=>{if(r.citizenId&&!map.has(r.citizenId))map.set(r.citizenId,{id:r.citizenId,name:r.citizen,email:r.citizenEmail,role:'Citoyen',status:'Actif'})});setItems(Array.from(map.values()))}).catch(()=>mounted&&setError("Le backend actuel n’expose pas encore un annuaire administratif complet des utilisateurs.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const rows=useMemo(()=>items.filter(u=>!q||`${u.name} ${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase())),[items,q]);
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Comptes" title="Utilisateurs"/><main className="portal-content">{error?<div className="error-card">{error}</div>:null}<section className="toolbar-card"><div className="toolbar-line"><label className="portal-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, e-mail, identifiant..."/></label></div></section><section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<><p className="detail-copy">Cette vue liste les citoyens identifiables depuis les demandes. La gestion complète des comptes reste assurée par l’administration Django tant qu’un endpoint dédié n’est pas exposé.</p><div className="portal-table portal-table--users"><div className="portal-table__head"><span>Utilisateur</span><span>ID</span><span>Rôle</span><span>Statut</span><span/></div>{rows.map(u=><div className="portal-table__row static" key={u.id}><span><b>{u.name}</b><small>{u.email||'—'}</small></span><span className="mono">#{u.id}</span><span>{u.role}</span><span><em className="status-pill status-actif">{u.status}</em></span><span/></div>)}</div></>}</section></main></div></div>;
}
