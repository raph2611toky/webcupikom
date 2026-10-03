import { logout, navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const items = [
  ["/admin", "◫", "Tableau de bord"],
  ["/admin/users", "◉", "Utilisateurs"],
  ["/admin/services", "◇", "Services"],
  ["/admin/news", "▤", "Actualités"],
  ["/admin/settings", "⚙", "Paramètres"],
];

export default function AdminSidebar() {
  const path = window.location.pathname;
  return <aside className="portal-sidebar portal-sidebar--admin">
    <button className="portal-sidebar__brand" onClick={() => navigate("/")}>Terra<span>Nova</span></button>
    <div className="portal-sidebar__role">Administration</div>
    <nav>{items.map(([to, icon, label]) => {
      const active = to === "/admin" ? path === to : path.startsWith(to);
      return <button key={to} className={active ? "is-active" : ""} onClick={() => navigate(to)}><i>{icon}</i><span>{label}</span></button>;
    })}</nav>
    <div className="portal-sidebar__bottom">
      <button onClick={logout}><i>↗</i><span>Déconnexion</span></button>
    </div>
  </aside>;
}
