import PortalIcon from "./PortalIcon.jsx";
import "../../styles/portal.css";
import novaSidebarLogo from "../../assets/sidebar/nova-sidebar-logo.png";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import { t, useLocale } from "../../utils/i18n.js";

export default function CitizenSidebar() {
  const [locale] = useLocale();
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving,setLeaving]=useState(false);

  const items = [
    ["/citizen", "home", t("dashboard", locale)],
    ["/citizen/requests", "requests", t("requests", locale)],
    ["/citizen/signalements", "reports", t("reports", locale)],
    ["/citizen/services", "services", t("services", locale)],
    ["/citizen/transport", "transport", locale === "en" ? "Transport" : locale === "mg" ? "Fitaterana" : "Transport"],
    ["/citizen/partners", "partners", locale === "en" ? "Partners" : locale === "mg" ? "Mpiara-miombon'antoka" : "Partenaires"],
    ["/citizen/appointments", "appointments", t("appointments", locale)],
    ["/citizen/messages", "messages", t("messages", locale)],
    ["/citizen/news", "news", t("news", locale)],
    ["/citizen/projects", "projects", locale === "en" ? "Projects" : locale === "mg" ? "Tetikasa" : "Projets"],
    ["/citizen/profile", "profile", t("profile", locale)],
    ["/citizen/settings", "settings", t("settings", locale)],
  ];

  async function signOut(){
    if(leaving)return;
    setLeaving(true);
    try{await logout()}finally{navigate("/",{replace:true})}
  }

  return <aside className="portal-sidebar portal-sidebar--citizen">
    <button className="portal-sidebar__brand citizen-sidebar-brand" aria-label="Nova Terra, tableau de bord" onClick={() => navigate("/citizen")}>
      <img src={novaSidebarLogo} alt="" aria-hidden="true" />
      <span className="sr-only">Nova Terra</span>
    </button>

    <nav className="citizen-nav-flat" aria-label="Navigation de l’espace citoyen">
      {items.map(([to, icon, label]) => {
        const active = to === "/citizen" ? path === to || path === "/citizen/dashboard" : path.startsWith(to);
        return <button key={to} title={label} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}>
          <i aria-hidden="true"><PortalIcon name={icon}/></i><span>{label}</span>
        </button>;
      })}
    </nav>

    <div className="portal-sidebar__bottom">
      <button onClick={() => navigate("/citizen/help")}><i aria-hidden="true">?</i><span>{t("contact", locale)}</span></button>
      <button onClick={signOut} disabled={leaving}><i aria-hidden="true">↗</i><span>{leaving?"…":t("logout", locale)}</span></button>
    </div>

    <div className="citizen-sidebar-signature" aria-hidden="true">
      <span className="citizen-sidebar-signature__planet">◒</span>
      <span><strong>Nova Terra</strong><small>Demain se construit<br/>avec vous.</small></span>
    </div>
  </aside>;
}
