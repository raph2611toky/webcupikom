import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getLocale, t } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

export default function CitizenSidebar() {
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const locale = getLocale();

  const items = [
    ["/citizen", "◫", t("dashboard", locale)],
    ["/citizen/requests", "◎", t("requests", locale)],
    ["/citizen/services", "◇", t("services", locale)],
    ["/citizen/news", "▤", t("news", locale)],
    ["/citizen/profile", "○", t("profile", locale)],
    ["/citizen/notifications", "◌", t("notifications", locale)],
    ["/citizen/messages", "✉", t("messages", locale)],
    ["/citizen/settings", "⚙", t("settings", locale)],
  ];

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  }

  return <aside className="portal-sidebar">
    <button className="portal-sidebar__brand" onClick={() => navigate("/citizen")} aria-label="Nova Terra, tableau de bord">Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">{t("citizenSpace", locale)}</div>
    <nav aria-label="Navigation de l’espace citoyen">
      {items.map(([to, icon, label]) => {
        const active = to === "/citizen" ? path === to || path === "/citizen/dashboard" : path.startsWith(to);
        return <button key={to} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>;
      })}
    </nav>
    <div className="portal-sidebar__bottom">
      <button onClick={() => window.dispatchEvent(new CustomEvent("nova-help"))}><i aria-hidden="true">?</i><span>{t("help", locale)}</span></button>
      <button onClick={signOut} disabled={leaving}><i aria-hidden="true">↗</i><span>{leaving ? "…" : t("logout", locale)}</span></button>
    </div>
  </aside>;
}
