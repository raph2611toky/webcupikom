import "../../styles/portal.css";
import { lazy, Suspense } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";
import { t, useLocale } from "../../utils/i18n.js";

const LanguageSwitcher = lazy(() => import("./LanguageSwitcher.jsx"));
const VoiceControl = lazy(() => import("./VoiceControl.jsx"));
const CitizenGuide = lazy(() => import("./CitizenGuide.jsx"));
const NotificationBell = lazy(() => import("./NotificationBell.jsx"));
const AlertShortcut = lazy(() => import("./AlertShortcut.jsx"));

const LABELS = {
  fr: {
    citizen:"Espace citoyen", agent:"Espace agent", admin:"Administration", dashboard:"Tableau de bord", profile:"Mon profil",
    requests:"Mes demandes", reports:"Signalements", signalements:"Signalements", services:"Services", news:"Actualités", notifications:"Notifications", appointments:"Rendez-vous", messages:"Messages",
    transport:"Transport", settings:"Paramètres", projects:"Projets", "supprimer-compte":"Supprimer le compte", citizens:"Citoyens", users:"Utilisateurs", api:"Flux WebCup", help:"Nous contacter",
  },
  en: {
    citizen:"Citizen space", agent:"Agent space", admin:"Administration", dashboard:"Dashboard", profile:"My profile",
    requests:"My requests", reports:"Reports", signalements:"Reports", services:"Services", news:"News", notifications:"Notifications", appointments:"Appointments", messages:"Messages",
    transport:"Transport", settings:"Settings", projects:"Projects", "supprimer-compte":"Delete account", citizens:"Citizens", users:"Users", api:"WebCup feed", help:"Contact us",
  },
  mg: {
    citizen:"Habaka mponina", agent:"Habaka mpiasan'ny tanàna", admin:"Fitantanana", dashboard:"Tabilao", profile:"Ny mombamomba ahy",
    requests:"Ny fangatahako", reports:"Tatitra", signalements:"Tatitra", services:"Sampan-draharaha", news:"Vaovao", notifications:"Fampahafantarana", appointments:"Fotoana fihaonana", messages:"Hafatra",
    transport:"Fitaterana", settings:"Fikirana", projects:"Tetikasa", "supprimer-compte":"Hamafa kaonty", citizens:"Mponina", users:"Mpampiasa", api:"WebCup", help:"Hifandray aminay",
  },
};

function Breadcrumbs({ locale }) {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const labels = LABELS[locale] || LABELS.fr;
  const items = parts.map((part, index) => ({
    label: labels[part] || decodeURIComponent(part),
    path: `/${parts.slice(0, index + 1).join("/")}`,
  }));

  return (
    <nav className="portal-breadcrumb" aria-label="Fil d’Ariane">
      {items.map((item, index) => (
        <span key={item.path}>
          {index < items.length - 1
            ? <button type="button" onClick={() => navigate(item.path)}>{item.label}</button>
            : <b aria-current="page">{item.label}</b>}
          {index < items.length - 1 ? <i aria-hidden="true">/</i> : null}
        </span>
      ))}
    </nav>
  );
}

export default function PortalTopbar({ eyebrow, title, subtitle, actions }) {
  const { user } = useAuth();
  const [locale] = useLocale();
  const displayName = user?.display_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email || "Nova Terra";
  const initials = displayName.split(/\s+/).filter(Boolean).map((part)=>part[0]).join("").slice(0,2).toUpperCase() || "NT";

  return (
    <>
      <header className={`portal-topbar${user?.role === "citizen" ? " portal-topbar--citizen" : ""}`}>
        <div className="portal-topbar__title">
          <div className="portal-topbar__meta">
            <Breadcrumbs locale={locale} />
            {window.location.pathname.split("/").filter(Boolean).length < 2 && eyebrow
              ? <span className="portal-topbar__eyebrow">{eyebrow}</span>
              : null}
          </div>
          <h1>{title}</h1>
          {subtitle ? <p className="portal-topbar__subtitle">{subtitle}</p> : null}
        </div>
        <div className="portal-topbar__right">
          {actions}
          {user?.role === "citizen" ? <Suspense fallback={null}><VoiceControl /></Suspense> : null}
          {user?.role === "citizen" ? <Suspense fallback={null}><LanguageSwitcher compact /></Suspense> : null}
          {user?.role === "citizen" ? <Suspense fallback={null}><AlertShortcut label={locale === "en" ? "City alerts" : locale === "mg" ? "Fanairana avy amin’ny tanàna" : "Alertes municipales"} /></Suspense> : null}
          {user?.role === "citizen" ? <Suspense fallback={null}><NotificationBell label={t("notifications", locale)} /></Suspense> : null}
          <div className="portal-user">
            <span className="portal-user__avatar">{initials}</span>
            <div><strong>{displayName}</strong><span>{
              user?.role === "citizen"
                ? (locale === "mg" ? "Mponina" : locale === "en" ? "Citizen" : "Citoyen")
                : user?.role === "agent" ? "Agent" : user?.role === "admin" ? "Admin" : (locale === "en" ? "Visitor" : locale === "mg" ? "Mpitsidika" : "Visiteur")
            }</span></div>
            {user?.role === "citizen" ? <span className="portal-user__chevron" aria-hidden="true">⌄</span> : null}
          </div>
        </div>
      </header>
      {user?.role === "citizen" ? <Suspense fallback={null}><CitizenGuide /></Suspense> : null}
    </>
  );
}
