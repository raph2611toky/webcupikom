import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate, roleHome } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

function go(event, to) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(to);
}

export default function PublicHeader() {
  const { ready, isAuthenticated, user } = useAuth();
  return (
    <header className="public-header">
      <a className="public-header__brand" href="/" onClick={(e) => go(e, "/")}>
        Terra<span>Nova</span>
      </a>
      <nav className="public-header__nav" aria-label="Navigation principale">
        <a href="/services" onClick={(e) => go(e, "/services")}>Services</a>
        <a href="/news" onClick={(e) => go(e, "/news")}>Actualités</a>
        <a href="/contact" onClick={(e) => go(e, "/contact")}>Contact</a>
      </nav>
      <div className="public-header__actions">
        {ready && isAuthenticated ? (
          <a className="public-header__cta" href={roleHome(user?.role)} onClick={(e) => go(e, roleHome(user?.role))}>Mon espace</a>
        ) : (
          <>
            <a className="public-header__login" href="/login" onClick={(e) => go(e, "/login")}>Se connecter</a>
            <a className="public-header__cta" href="/inscription" onClick={(e) => go(e, "/inscription")}>Créer un compte</a>
          </>
        )}
      </div>
    </header>
  );
}
