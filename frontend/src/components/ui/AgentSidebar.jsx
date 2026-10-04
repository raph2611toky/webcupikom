import "../../styles/portal.css";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";

const groups = [
  {
    label:"Traitement",
    items:[
      ["/agent", "◫", "Tableau de bord"],
      ["/agent/requests", "◎", "Demandes"],
      ["/agent/signalements", "!", "Signalements"],
      ["/agent/appointments", "◷", "Rendez-vous"],
      ["/agent/messages", "✉", "Messages"],
    ],
  },
  {
    label:"Gestion",
    items:[
      ["/agent/citizens", "◉", "Citoyens"],
      ["/agent/services", "◇", "Services"],
      ["/agent/projects", "✦", "Projets municipaux"],
      ["/agent/news", "▤", "Actualités"],
      ["/agent/audit", "⌁", "Journal d’activité"],
      ["/agent/security-events", "◇", "Sécurité"],
    ],
  },
];

export default function AgentSidebar() {
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving,setLeaving]=useState(false);
  async function signOut(){if(leaving)return;setLeaving(true);try{await logout()}finally{navigate("/",{replace:true})}}

  return <aside className="portal-sidebar portal-sidebar--agent">
    <button className="portal-sidebar__brand" aria-label="Nova Terra, tableau de bord" onClick={() => navigate("/agent")}>Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">Espace agent</div>
    <nav aria-label="Navigation de l’espace agent">
      {groups.map(group=><div className="agent-nav-group" key={group.label}>
        <span className="agent-nav-group__label">{group.label}</span>
        <div className="agent-nav-group__items">
          {group.items.map(([to, icon, label]) => {
            const active = to === "/agent" ? path === to : path.startsWith(to);
            return <button key={to} title={label} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>;
          })}
        </div>
      </div>)}
    </nav>
    <div className="portal-sidebar__bottom">
      <button onClick={signOut} disabled={leaving}><i aria-hidden="true">↗</i><span>{leaving?"Déconnexion…":"Déconnexion"}</span></button>
    </div>
  </aside>;
}
