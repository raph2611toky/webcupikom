import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

function go(event, to) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(to);
}

export default function PublicHeader() {
  const path = window.location.pathname;
  return (
    <header className="public-header">
      <a className="public-header__brand" aria-label="Nova Terra, accueil" href="/" onClick={(e) => go(e, "/")}>
        Nova<span>Terra</span>
      </a>
      <nav className="public-header__nav" aria-label="Navigation principale">
        <a href="/services" aria-current={path.startsWith("/services") ? "page" : undefined} onClick={(e) => go(e, "/services")}>Services</a>
        <a href="/news" aria-current={path.startsWith("/news") ? "page" : undefined} onClick={(e) => go(e, "/news")}>Actualités</a>
        <a href="/contact" aria-current={path === "/contact" ? "page" : undefined} onClick={(e) => go(e, "/contact")}>Contact</a>
      </nav>
      <div className="public-header__actions">
        <a className="public-header__login" href="/login" onClick={(e) => go(e, "/login")}>Se connecter</a>
        <a className="public-header__cta" href="/inscription" onClick={(e) => go(e, "/inscription")}>Créer un compte</a>
      </div>
    </header>
  );
}
