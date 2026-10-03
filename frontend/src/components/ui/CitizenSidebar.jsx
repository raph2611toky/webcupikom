import { logout, navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const items = [
  ["/citizen", "◫", "Tableau de bord"],
  ["/citizen/requests", "◎", "Mes demandes"],
  ["/citizen/services", "◇", "Services"],
  ["/citizen/news", "▤", "Actualités"],
  ["/citizen/profile", "○", "Mon profil"],
  ["/citizen/notifications", "◌", "Notifications"],
  ["/citizen/settings", "⚙", "Paramètres"],
];

export default function CitizenSidebar() {
  const path = window.location.pathname;
  return <aside className="portal-sidebar">
    <button className="portal-sidebar__brand" aria-label="Nova Terra, tableau de bord" onClick={() => navigate("/citizen")}>Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">Espace citoyen</div>
    <nav aria-label="Navigation de l’espace citoyen">{items.map(([to, icon, label]) => {
      const active = to === "/citizen" ? path === to : path.startsWith(to);
      return <button key={to} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>;
    })}</nav>
    <div className="portal-sidebar__bottom">
      <button onClick={() => window.dispatchEvent(new CustomEvent("terra-help"))}><i aria-hidden="true">?</i><span>Besoin d’aide</span></button>
      <button onClick={logout}><i aria-hidden="true">↗</i><span>Déconnexion</span></button>
    </div>
  </aside>;
}
