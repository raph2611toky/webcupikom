import { useAuth } from "../../auth/AuthContext.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { navigate, roleHome } from "../../utils/navigation.js";
import { t, useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";

function go(event, to) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(to);
}

export default function PublicHeader() {
  const path = window.location.pathname;
  const { isAuthenticated, user } = useAuth();
  const [locale] = useLocale();

  return (
    <header className="public-header">
      <a className="public-header__brand" aria-label="Nova Terra, accueil" href="/" onClick={(e) => go(e, "/")}>Nova<span>Terra</span></a>
      <nav className="public-header__nav" aria-label="Navigation principale">
        <a href="/services" aria-current={path.startsWith("/services") ? "page" : undefined} onClick={(e) => go(e, "/services")}>{t("services", locale)}</a>
        <a href="/news" aria-current={path.startsWith("/news") ? "page" : undefined} onClick={(e) => go(e, "/news")}>{t("news", locale)}</a>
        <a href="/contact" aria-current={path === "/contact" ? "page" : undefined} onClick={(e) => go(e, "/contact")}>{locale === "mg" ? "Fifandraisana" : "Contact"}</a>
      </nav>
      <div className="public-header__actions">
        <LanguageSwitcher compact />
        {isAuthenticated ? (
          <a className="public-header__cta" href={roleHome(user?.role)} onClick={(e)=>go(e,roleHome(user?.role))}>{t("mySpace", locale)}</a>
        ) : (
          <>
            <a className="public-header__login" href="/login" onClick={(e) => go(e, "/login")}>{t("login", locale)}</a>
            <a className="public-header__cta" href="/inscription" onClick={(e) => go(e, "/inscription")}>{t("register", locale)}</a>
          </>
        )}
      </div>
    </header>
  );
}
