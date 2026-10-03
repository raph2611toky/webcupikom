import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const items = [
  ["/admin", "◫", "Tableau de bord"],
  ["/admin/users", "◉", "Utilisateurs"],
  ["/admin/services", "◇", "Services"],
  ["/admin/appointments", "◷", "Rendez-vous"],
  ["/admin/news", "▤", "Actualités"],
  ["/admin/settings", "⚙", "Paramètres"],
];

export default function AdminSidebar() {
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving,setLeaving]=useState(false);
  async function signOut(){if(leaving)return;setLeaving(true);try{await logout()}finally{navigate("/",{replace:true})}}
  return <aside className="portal-sidebar portal-sidebar--admin">
    <button className="portal-sidebar__brand" aria-label="Nova Terra, tableau de bord" onClick={() => navigate("/admin")}>Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">Administration</div>
    <nav aria-label="Navigation de l’administration">{items.map(([to, icon, label]) => {
      const active = to === "/admin" ? path === to : path.startsWith(to);
      return <button key={to} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>;
    })}</nav>
    <div className="portal-sidebar__bottom">
      <button onClick={signOut}><i aria-hidden="true">↗</i><span>Déconnexion</span></button>
    </div>
  </aside>;
}
