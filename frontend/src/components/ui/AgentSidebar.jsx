import { logout, navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const items = [
  ["/agent", "◫", "Tableau de bord"],
  ["/agent/requests", "◎", "Demandes"],
  ["/agent/citizens", "◉", "Citoyens"],
  ["/agent/news", "▤", "Publications"],
  ["/agent/services", "◇", "Services"],
  ["/agent/api", "⌘", "Flux WebCup"],
];

export default function AgentSidebar() {
  const path = window.location.pathname;
  return <aside className="portal-sidebar portal-sidebar--agent">
    <button className="portal-sidebar__brand" aria-label="Nova Terra, tableau de bord" onClick={() => navigate("/agent")}>Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">Espace agent</div>
    <nav aria-label="Navigation de l’espace agent">{items.map(([to, icon, label]) => {
      const active = to === "/agent" ? path === to : path.startsWith(to);
      return <button key={to} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>;
    })}</nav>
    <div className="portal-sidebar__bottom">
      <button onClick={logout}><i aria-hidden="true">↗</i><span>Déconnexion</span></button>
    </div>
  </aside>;
}
