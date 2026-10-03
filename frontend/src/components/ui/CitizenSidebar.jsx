import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const items = [
  ["/citizen", "◫", "Tableau de bord"],
  ["/citizen/profile", "○", "Mon profil"],
  ["/citizen/requests", "◎", "Mes demandes"],
  ["/citizen/services", "◇", "Services"],
  ["/citizen/notifications", "◌", "Notifications"],
  ["/citizen/settings", "⚙", "Paramètres"],
];

export default function CitizenSidebar() {
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving,setLeaving]=useState(false);
  async function signOut(){if(leaving)return;setLeaving(true);try{await logout()}finally{navigate('/login',{replace:true})}}
  return <aside className="portal-sidebar">
    <button className="portal-sidebar__brand" onClick={() => navigate("/")}>Terra<span>Nova</span></button>
    <div className="portal-sidebar__role">Espace citoyen</div>
    <nav>{items.map(([to, icon, label]) => {
      const active = to === "/citizen" ? path === to : path.startsWith(to);
      return <button key={to} className={active ? "is-active" : ""} onClick={() => navigate(to)}><i>{icon}</i><span>{label}</span></button>;
    })}</nav>
    <div className="portal-sidebar__bottom">
      <button onClick={() => navigate("/contact")}><i>?</i><span>Besoin d’aide</span></button>
      <button onClick={signOut} disabled={leaving}><i>↗</i><span>{leaving?'Déconnexion…':'Déconnexion'}</span></button>
    </div>
  </aside>;
}
