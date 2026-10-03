import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import AccountSettingsCard from "../../components/ui/AccountSettingsCard.jsx";
import { getAdminSystem } from "../../api/admin.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AdminSettings(){
  const [system,setSystem]=useState(null),[error,setError]=useState('');
  useEffect(()=>{getAdminSystem().then(setSystem).catch(e=>setError(getApiErrorMessage(e,"Impossible de vérifier le système.")))},[]);
  const webcup=system?.webcup||{},security=system?.security||{};
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Configuration" title="Paramètres"/><main className="portal-content">{error?<div className="error-card">{error}</div>:null}<div className="settings-grid"><section className="portal-card"><span className="section-label">Plateforme</span><h3>État de l’API</h3><div className="system-check"><div><i className={system?.api?.status==='ok'?'ok':''}/><span>API Nova Terra</span><b>{system?.api?.status||'Vérification…'}</b></div><div><i className={security.jwt_refresh_cookie==='HttpOnly'?'ok':''}/><span>Cookie refresh</span><b>{security.jwt_refresh_cookie||'—'}</b></div><div><i className={security.sensitive_settings_exposed===false?'ok':''}/><span>Secrets frontend</span><b>{security.sensitive_settings_exposed===false?'Non exposés':'—'}</b></div></div></section><section className="portal-card"><span className="section-label">Flux WebCup</span><h3>{webcup.session?.status||'Non démarré'}</h3><div className="detail-list"><div><span>Configuré</span><b>{webcup.configured?'Oui':'Non'}</b></div><div><span>Dernière synchro</span><b>{webcup.last_success_at||'—'}</b></div><div><span>Dernière erreur</span><b>{webcup.last_error||'Aucune'}</b></div></div><button className="primary-action" onClick={()=>navigate('/admin/webcup')}>Ouvrir le flux →</button></section><section className="portal-card"><span className="section-label">Rôles</span><h3>Contrôle d’accès backend</h3><p className="detail-copy">{(security.roles||[]).join(' · ')||'citizen · agent · admin'}</p></section><AccountSettingsCard /></div></main></div></div>;
}
