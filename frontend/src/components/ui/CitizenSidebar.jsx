import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import { t, useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";
import "../../styles/pages/citizen-polish.css";

export default function CitizenSidebar() {
  const [locale] = useLocale();
  const path = window.location.pathname;
  const { logout } = useAuth();
  const [leaving,setLeaving]=useState(false);

  const groups = [
    {
      label: locale === "en" ? "My activity" : locale === "mg" ? "Ny asa ataoko" : "Mes démarches",
      items: [
        ["/citizen", "◫", t("dashboard", locale)],
        ["/citizen/requests", "◎", t("requests", locale)],
        ["/citizen/signalements", "!", t("reports", locale)],
        ["/citizen/appointments", "◷", t("appointments", locale)],
        ["/citizen/messages", "✉", t("messages", locale)],
      ],
    },
    {
      label: locale === "en" ? "Nova Terra" : locale === "mg" ? "Nova Terra" : "La ville",
      items: [
        ["/citizen/services", "◇", t("services", locale)],
        ["/citizen/news", "▤", t("news", locale)],
        ["/citizen/projects", "✦", locale === "en" ? "Projects" : locale === "mg" ? "Tetikasa" : "Projets"],
      ],
    },
    {
      label: locale === "en" ? "Account" : locale === "mg" ? "Kaonty" : "Compte",
      items: [
        ["/citizen/profile", "○", t("profile", locale)],
        ["/citizen/settings", "⚙", t("settings", locale)],
      ],
    },
  ];

  async function signOut(){
    if(leaving)return;
    setLeaving(true);
    try{await logout()}finally{navigate("/",{replace:true})}
  }

  return <aside className="portal-sidebar portal-sidebar--citizen">
    <button className="portal-sidebar__brand" aria-label="Nova Terra, tableau de bord" onClick={() => navigate("/citizen")}>Nova<span>Terra</span></button>
    <div className="portal-sidebar__role">{t("citizenSpace", locale)}</div>
    <nav aria-label="Navigation de l’espace citoyen">
      {groups.map(group=><div className="citizen-nav-group" key={group.label}>
        <span className="citizen-nav-group__label">{group.label}</span>
        <div className="citizen-nav-group__items">
          {group.items.map(([to, icon, label]) => {
            const active = to === "/citizen" ? path === to || path === "/citizen/dashboard" : path.startsWith(to);
            return <button key={to} title={label} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(to)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>;
          })}
        </div>
      </div>)}
    </nav>
    <div className="portal-sidebar__bottom">
      <button onClick={() => navigate("/citizen/help")}><i aria-hidden="true">?</i><span>{t("contact", locale)}</span></button>
      <button onClick={signOut} disabled={leaving}><i aria-hidden="true">↗</i><span>{leaving?"…":t("logout", locale)}</span></button>
    </div>
  </aside>;
}
