import PortalIcon from "./PortalIcon.jsx";
import "../../styles/portal.css";
import novaSidebarLogo from "../../assets/sidebar/nova-sidebar-logo.png";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";

const groups = [
  {
    label:"Traitement",
    items:[
      ["/agent", "home", "Tableau de bord"],
      ["/agent/requests", "requests", "Demandes"],
      ["/agent/signalements", "reports", "Signalements"],
      ["/agent/appointments", "appointments", "Rendez-vous"],
      ["/agent/messages", "messages", "Messages"],
    ],
  },
  {
    label:"Gestion",
    items:[
      ["/agent/citizens", "users", "Citoyens"],
      ["/agent/services", "services", "Services"],
      ["/agent/projects", "projects", "Projets municipaux"],
      ["/agent/news", "news", "Actualités"],
      ["/agent/audit", "audit", "Journal d’activité"],
      ["/agent/security-events", "security", "Sécurité"],
    ],
  },
];

export default function AgentSidebar() {
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving,setLeaving]=useState(false);
  const [collapsed,setCollapsed]=useState(()=>{
    try{return localStorage.getItem("nova-agent-sidebar-collapsed")==="1"}catch{return false}
  });

  useEffect(()=>{
    document.body.classList.toggle("portal-sidebar-collapsed",collapsed);
    try{localStorage.setItem("nova-agent-sidebar-collapsed",collapsed?"1":"0")}catch{}
    return()=>document.body.classList.remove("portal-sidebar-collapsed");
  },[collapsed]);

  async function signOut(){
    if(leaving)return;
    setLeaving(true);
    try{await logout()}finally{navigate("/",{replace:true})}
  }

  return <aside className={`portal-sidebar portal-sidebar--agent staff-sidebar${collapsed?" is-collapsed":""}`}>
    <button
      type="button"
      className="staff-sidebar-toggle"
      aria-label={collapsed?"Développer le menu":"Réduire le menu"}
      aria-expanded={!collapsed}
      title={collapsed?"Développer le menu":"Réduire le menu"}
      onClick={()=>setCollapsed(value=>!value)}
    ><span aria-hidden="true">{collapsed?"›":"‹"}</span></button>

    <button className="portal-sidebar__brand staff-sidebar-brand" aria-label="Nova Terra, espace agent" onClick={()=>navigate("/agent")}>
      <img src={novaSidebarLogo} alt="" aria-hidden="true" />
      <span className="sr-only">Nova Terra</span>
    </button>

    <div className="portal-sidebar__role staff-sidebar-role"><span>AGENT</span> Centre opérationnel</div>

    <nav className="staff-nav" aria-label="Navigation de l’espace agent">
      {groups.map(group=><div className="staff-nav-group agent-nav-group" key={group.label}>
        <span className="staff-nav-group__label agent-nav-group__label">{group.label}</span>
        <div className="staff-nav-group__items agent-nav-group__items">
          {group.items.map(([to,icon,label])=>{
            const active=to==="/agent"?path===to:path.startsWith(to);
            return <button key={to} title={label} className={active?"is-active":""} aria-current={active?"page":undefined} onClick={()=>navigate(to)}>
              <i aria-hidden="true"><PortalIcon name={icon}/></i><span>{label}</span>
            </button>;
          })}
        </div>
      </div>)}
    </nav>

    <div className="portal-sidebar__bottom">
      <button title="Déconnexion" onClick={signOut} disabled={leaving}><i aria-hidden="true">↗</i><span>{leaving?"Déconnexion…":"Déconnexion"}</span></button>
    </div>

    <div className="staff-sidebar-signature" aria-hidden="true">
      <span className="staff-sidebar-signature__core">O</span>
      <span><strong>Nova Terra</strong><small>Observer · traiter<br/>accompagner la ville.</small></span>
    </div>
  </aside>;
}
