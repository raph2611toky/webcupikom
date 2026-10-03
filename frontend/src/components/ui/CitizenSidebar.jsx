import { logout, navigate } from "../../utils/navigation.js";
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
  return <aside className="portal-sidebar">
    <button className="portal-sidebar__brand" onClick={() => navigate("/citizen")}>Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">Espace citoyen</div>
    <nav>{items.map(([to, icon, label]) => {
      const active = to === "/citizen" ? path === to : path.startsWith(to);
      return <button key={to} className={active ? "is-active" : ""} onClick={() => navigate(to)}><i>{icon}</i><span>{label}</span></button>;
    })}</nav>
    <div className="portal-sidebar__bottom">
      <button onClick={() => window.dispatchEvent(new CustomEvent("terra-help"))}><i>?</i><span>Besoin d’aide</span></button>
      <button onClick={logout}><i>↗</i><span>Déconnexion</span></button>
    </div>
  </aside>;
}
