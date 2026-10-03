import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { updateProfile } from "../../api/account.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { ROLE_LABELS } from "../../constants/roles.js";
import { getLocale, setLocale, t } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const ROLE_SHORTCUT = Object.freeze({
  citizen: { to: "/citizen/notifications", label: "Notifications", icon: "⌁" },
  agent: { to: "/agent/messages", label: "Messages citoyens", icon: "✉" },
  admin: { to: "/admin/messages", label: "Messages citoyens", icon: "✉" },
});

const CRUMBS = {
  citizen: "Espace citoyen",
  agent: "Espace agent",
  admin: "Administration",
  dashboard: "Tableau de bord",
  profile: "Mon profil",
  requests: "Mes demandes",
  services: "Services",
  news: "Actualités",
  notifications: "Notifications",
  messages: "Messages",
  settings: "Paramètres",
  citizens: "Citoyens",
  users: "Utilisateurs",
  api: "Flux WebCup",
  webcup: "Flux WebCup",
};

function Breadcrumbs() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  const items = parts.map((part, index) => ({
    label: CRUMBS[part] || decodeURIComponent(part),
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

export default function PortalTopbar({ eyebrow, title, actions = null }) {
  const { user, replaceUser } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState("");
  const [locale, setLocaleState] = useState(() => user?.locale || getLocale());
  const [localeBusy, setLocaleBusy] = useState(false);
  const [localeError, setLocaleError] = useState("");

  useEffect(() => {
    setLocaleState(user?.locale || getLocale());
  }, [user?.locale]);

  useEffect(() => {
    const openHelp = () => setHelpOpen(true);
    window.addEventListener("nova-help", openHelp);
    return () => window.removeEventListener("nova-help", openHelp);
  }, []);

  const displayName = user?.display_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email || "Nova Terra";
  const initials = (displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "NT").toUpperCase();
  const shortcut = ROLE_SHORTCUT[user?.role];

  async function changeLanguage(next) {
    if (!["fr", "en"].includes(next) || localeBusy) return;
    setLocaleState(next);
    setLocale(next);
    setLocaleError("");
    setLocaleBusy(true);
    try {
      const updated = await updateProfile({ locale: next });
      replaceUser(updated);
      window.location.reload();
    } catch (error) {
      setLocaleError(getApiErrorMessage(error, "La langue est appliquée sur cet appareil, mais n’a pas pu être synchronisée avec le compte."));
    } finally {
      setLocaleBusy(false);
    }
  }

  function closeHelp() {
    setHelpOpen(false);
    setHelpQuestion("");
  }

  function openRequest(type = "question", message = "") {
    closeHelp();
    const params = new URLSearchParams({ new: "1", type });
    if (message.trim()) params.set("message", message.trim());
    navigate(`/citizen/requests?${params.toString()}`);
  }

  function submitHelp(event) {
    event.preventDefault();
    if (!helpQuestion.trim()) return;
    openRequest("question", helpQuestion);
  }

  return (
    <>
      <header className="portal-topbar">
        <div className="portal-topbar__title">
          <Breadcrumbs />
          {eyebrow ? <span className="portal-topbar__eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
        </div>

        <div className="portal-topbar__right">
          {actions}

          <label className="portal-language" aria-label={t("language", locale)}>
            <span aria-hidden="true">文</span>
            <select value={locale} disabled={localeBusy} onChange={(e)=>changeLanguage(e.target.value)}>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </label>

          {shortcut ? <button className="portal-topbar__icon" type="button" aria-label={shortcut.label} onClick={() => navigate(shortcut.to)}>{shortcut.icon}</button> : null}

          <div className="portal-user">
            <span className="portal-user__avatar">{initials}</span>
            <div><strong>{displayName}</strong><span>{ROLE_LABELS[user?.role] || user?.role || "visiteur"}</span></div>
          </div>
        </div>
      </header>

      {localeError ? <div className="portal-locale-warning" role="status">{localeError}</div> : null}

      {helpOpen && user?.role === "citizen" ? <div className="portal-help-backdrop" onMouseDown={closeHelp}>
        <section className="portal-help portal-help--working" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-label="Assistant Nova Terra">
          <button className="portal-help__close" type="button" onClick={closeHelp}>×</button>
          <span className="section-label">Besoin d’aide</span>
          <h2>Que souhaitez-vous faire ?</h2>
          <p>Vous restez dans votre espace citoyen. Choisissez une action ou décrivez directement votre problème.</p>

          <div className="portal-help__choices portal-help__choices--4">
            <button type="button" onClick={() => openRequest("question")}><i>?</i><span>Poser une question</span><b>→</b></button>
            <button type="button" onClick={() => openRequest("signalement")}><i>!</i><span>Signaler un problème</span><b>→</b></button>
            <button type="button" onClick={() => { closeHelp(); navigate("/citizen/requests"); }}><i>◎</i><span>Suivre mes demandes</span><b>→</b></button>
            <button type="button" onClick={() => { closeHelp(); navigate("/citizen/services"); }}><i>◇</i><span>Trouver un service</span><b>→</b></button>
          </div>

          <form className="portal-help__ask portal-help__ask--working" onSubmit={submitHelp}>
            <label>
              <span>Ou décrivez votre besoin</span>
              <input value={helpQuestion} onChange={(event)=>setHelpQuestion(event.target.value)} aria-label="Votre question" placeholder="Ex. Je n’ai pas reçu mon document..." />
            </label>
            <button type="submit" disabled={!helpQuestion.trim()}>Continuer →</button>
          </form>
        </section>
      </div> : null}
    </>
  );
}
