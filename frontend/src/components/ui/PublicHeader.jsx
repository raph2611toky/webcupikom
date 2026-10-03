import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getLocale, setLocale, t } from "../../utils/i18n.js";
import { navigate, roleHome } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

function go(event, to) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(to);
}

export default function PublicHeader() {
  const path = window.location.pathname;
  const { isAuthenticated, user } = useAuth();
  const [locale, setLocaleState] = useState(() => getLocale());

  function changeLanguage(next) {
    setLocaleState(next);
    setLocale(next);
    window.location.reload();
  }

  return (
    <header className="public-header">
      <a className="public-header__brand" aria-label="Nova Terra, accueil" href="/" onClick={(e) => go(e, "/")}>
        Nova<span>Terra</span>
      </a>

      <nav className="public-header__nav" aria-label="Navigation principale">
        <a href="/services" aria-current={path.startsWith("/services") ? "page" : undefined} onClick={(e) => go(e, "/services")}>{t("services", locale)}</a>
        <a href="/news" aria-current={path.startsWith("/news") ? "page" : undefined} onClick={(e) => go(e, "/news")}>{t("news", locale)}</a>
        <a href="/contact" aria-current={path === "/contact" ? "page" : undefined} onClick={(e) => go(e, "/contact")}>{t("contact", locale)}</a>
      </nav>

      <div className="public-header__actions">
        <label className="public-language" aria-label={t("language", locale)}>
          <select value={locale} onChange={(e)=>changeLanguage(e.target.value)}>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </label>

        {isAuthenticated
          ? <a className="public-header__cta" href={roleHome(user?.role)} onClick={(e)=>go(e, roleHome(user?.role))}>Mon espace</a>
          : <>
              <a className="public-header__login" href="/login" onClick={(e) => go(e, "/login")}>Se connecter</a>
              <a className="public-header__cta" href="/inscription" onClick={(e) => go(e, "/inscription")}>Créer un compte</a>
            </>}
      </div>
    </header>
  );
}
