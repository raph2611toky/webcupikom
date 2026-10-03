import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getWebcupFeed } from "../../api/webcup.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AdminSettings(){
  const [feedStatus,setFeedStatus]=useState("Vérification…");
  useEffect(()=>{getWebcupFeed().then(data=>setFeedStatus(data?.session?.status||"Disponible")).catch(()=>setFeedStatus("Indisponible"))},[]);
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Configuration" title="Paramètres"/><main className="portal-content"><div className="settings-grid"><section className="portal-card"><span className="section-label">Plateforme</span><h3>Configuration actuelle</h3><p className="detail-copy">Les paramètres métier restent pilotés côté backend. Cette page n’envoie aucune valeur sensible depuis le navigateur.</p></section><section className="portal-card"><span className="section-label">Identité</span><h3>Informations de la ville</h3><div className="profile-form-grid"><label><span>Nom de la ville</span><input disabled value="Terra Nova" readOnly/></label><label><span>API</span><input disabled value="Configurée via VITE_API_BASE_URL" readOnly/></label></div></section><section className="portal-card"><span className="section-label">Système</span><h3>État des intégrations</h3><div className="system-check"><div><i className="ok"/><span>Authentification</span><b>Backend JWT + cookie HttpOnly</b></div><div><i className="ok"/><span>Services municipaux</span><b>API connectée</b></div><div><i className={feedStatus==="Indisponible"?"":"ok"}/><span>Flux WebCup</span><b>{feedStatus}</b></div></div></section></div></main></div></div>;
}
