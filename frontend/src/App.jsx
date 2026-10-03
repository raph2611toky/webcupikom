import { useEffect, useMemo, useState } from "react";
import LandingPage from "./pages/Landing/LandingPage.jsx";
import LoginPage from "./pages/Login/LoginPage.jsx";
import InscriptionPage from "./pages/Inscription/InscriptionPage.jsx";
import Services from "./pages/public/Services.jsx";
import ServiceDetails from "./pages/public/ServiceDetails.jsx";
import News from "./pages/public/News.jsx";
import NewsDetails from "./pages/public/NewsDetails.jsx";
import Contact from "./pages/public/Contact.jsx";
import CitizenDashboard from "./pages/citizen/CitizenDashboard.jsx";
import CitizenProfile from "./pages/citizen/CitizenProfile.jsx";
import CitizenRequests from "./pages/citizen/CitizenRequests.jsx";
import CitizenRequestDetails from "./pages/citizen/CitizenRequestDetails.jsx";
import CitizenServices from "./pages/citizen/CitizenServices.jsx";
import CitizenNotifications from "./pages/citizen/CitizenNotifications.jsx";
import CitizenNews from "./pages/citizen/CitizenNews.jsx";
import CitizenNewsDetails from "./pages/citizen/CitizenNewsDetails.jsx";
import CitizenSettings from "./pages/citizen/CitizenSettings.jsx";
import AgentDashboard from "./pages/agent/AgentDashboard.jsx";
import AgentRequests from "./pages/agent/AgentRequests.jsx";
import AgentRequestDetails from "./pages/agent/AgentRequestDetails.jsx";
import AgentCitizens from "./pages/agent/AgentCitizens.jsx";
import AgentCitizenDetails from "./pages/agent/AgentCitizenDetails.jsx";
import AgentApi from "./pages/agent/AgentApi.jsx";
import AgentNews from "./pages/agent/AgentNews.jsx";
import AgentServices from "./pages/agent/AgentServices.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminServices from "./pages/admin/AdminServices.jsx";
import AdminNews from "./pages/admin/AdminNews.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import { getSession, navigate, roleHome } from "./utils/navigation.js";
import { loadAccessibilityPreferences, saveAccessibilityPreferences, resetAccessibilityPreferences } from "./utils/accessibility.js";
import "./styles/app-shell.css";

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function useLocationPath() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));
  useEffect(() => {
    const change = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  return pathname;
}

function match(pattern, pathname) {
  const a = pattern.split("/").filter(Boolean);
  const b = pathname.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function Protected({ roles, children }) {
  const session = getSession();
  useEffect(() => {
    if (!session) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      navigate(`/login?next=${next}`, { replace: true });
      return;
    }
    if (roles && !roles.includes(session.role)) navigate(roleHome(session.role), { replace: true });
  }, [roles, session]);
  if (!session || (roles && !roles.includes(session.role))) return null;
  return children;
}

export default function App() {
  const pathname = useLocationPath();
  const [a11yOpen, setA11yOpen] = useState(false);
  const [a11y, setA11y] = useState(() => loadAccessibilityPreferences());

  function updateAccessibility(patch) {
    const next = { ...a11y, ...patch };
    setA11y(next);
    saveAccessibilityPreferences(next);
  }

  function resetAccessibility() {
    const next = resetAccessibilityPreferences();
    setA11y(next);
  }

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      document.documentElement.style.setProperty("--screen-width", `${width}px`);
      document.documentElement.style.setProperty("--screen-height", `${height}px`);
      document.documentElement.style.setProperty("--screen-ratio", String(width / Math.max(height, 1)));
    };

    const isPortal = pathname.startsWith("/citizen") || pathname.startsWith("/agent") || pathname.startsWith("/admin");
    const isPublicSubpage = pathname.startsWith("/services") || pathname.startsWith("/news") || pathname === "/contact";
    const isAuth = pathname === "/login" || pathname === "/inscription" || pathname === "/register";
    document.body.dataset.routeGroup = isPortal ? "portal" : isPublicSubpage ? "public" : isAuth ? "auth" : "landing";

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, [pathname]);
  const route = useMemo(() => {
    const staticRoutes = {
      "/": <LandingPage />,
      "/landing": <LandingPage />,
      "/services": <Services />,
      "/news": <News />,
      "/contact": <Contact />,
      "/login": <LoginPage />,
      "/inscription": <InscriptionPage />,
      "/register": <InscriptionPage />,
      "/citizen": <Protected roles={["citizen"]}><CitizenDashboard /></Protected>,
      "/citizen/dashboard": <Protected roles={["citizen"]}><CitizenDashboard /></Protected>,
      "/citizen/profile": <Protected roles={["citizen"]}><CitizenProfile /></Protected>,
      "/citizen/requests": <Protected roles={["citizen"]}><CitizenRequests /></Protected>,
      "/citizen/services": <Protected roles={["citizen"]}><CitizenServices /></Protected>,
      "/citizen/news": <Protected roles={["citizen"]}><CitizenNews /></Protected>,
      "/citizen/notifications": <Protected roles={["citizen"]}><CitizenNotifications /></Protected>,
      "/citizen/settings": <Protected roles={["citizen"]}><CitizenSettings /></Protected>,
      "/agent": <Protected roles={["agent"]}><AgentDashboard /></Protected>,
      "/agent/dashboard": <Protected roles={["agent"]}><AgentDashboard /></Protected>,
      "/agent/requests": <Protected roles={["agent"]}><AgentRequests /></Protected>,
      "/agent/citizens": <Protected roles={["agent"]}><AgentCitizens /></Protected>,
      "/agent/news": <Protected roles={["agent"]}><AgentNews /></Protected>,
      "/agent/services": <Protected roles={["agent"]}><AgentServices /></Protected>,
      "/agent/api": <Protected roles={["agent"]}><AgentApi /></Protected>,
      "/admin": <Protected roles={["admin"]}><AdminDashboard /></Protected>,
      "/admin/dashboard": <Protected roles={["admin"]}><AdminDashboard /></Protected>,
      "/admin/users": <Protected roles={["admin"]}><AdminUsers /></Protected>,
      "/admin/services": <Protected roles={["admin"]}><AdminServices /></Protected>,
      "/admin/news": <Protected roles={["admin"]}><AdminNews /></Protected>,
      "/admin/settings": <Protected roles={["admin"]}><AdminSettings /></Protected>,
    };
    if (staticRoutes[pathname]) return staticRoutes[pathname];
    let params = match("/services/:slug", pathname); if (params) return <ServiceDetails params={params} />;
    params = match("/news/:slug", pathname); if (params) return <NewsDetails params={params} />;
    params = match("/citizen/requests/:id", pathname); if (params) return <Protected roles={["citizen"]}><CitizenRequestDetails params={params} /></Protected>;
    params = match("/citizen/news/:slug", pathname); if (params) return <Protected roles={["citizen"]}><CitizenNewsDetails params={params} /></Protected>;
    params = match("/agent/requests/:id", pathname); if (params) return <Protected roles={["agent"]}><AgentRequestDetails params={params} /></Protected>;
    params = match("/agent/citizens/:id", pathname); if (params) return <Protected roles={["agent"]}><AgentCitizenDetails params={params} /></Protected>;
    if (pathname === "/app") {
      const session = getSession();
      if (session) { navigate(roleHome(session.role), { replace: true }); return null; }
      navigate("/login", { replace: true }); return null;
    }
    return <LandingPage />;
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">Aller au contenu principal</a>

      <div id="main-content" tabIndex="-1" className="app-route-content">
        {route}
      </div>

      <div className="a11y-dock">
        {a11yOpen ? (
          <section className="a11y-panel" id="a11y-panel" role="dialog" aria-modal="false" aria-labelledby="a11y-title">
            <div className="a11y-panel__head">
              <div>
                <strong id="a11y-title">Accessibilité</strong>
                <span>Affichage adapté à vos besoins</span>
              </div>
              <button className="a11y-panel__close" type="button" aria-label="Fermer les réglages d’accessibilité" onClick={() => setA11yOpen(false)}>×</button>
            </div>

            <div className="a11y-setting">
              <span className="a11y-setting__label">Taille du texte</span>
              <div className="a11y-size-buttons" role="group" aria-label="Taille du texte">
                <button type="button" aria-pressed={a11y.fontSize === "normal"} onClick={() => updateAccessibility({ fontSize: "normal" })}>A</button>
                <button type="button" aria-pressed={a11y.fontSize === "large"} onClick={() => updateAccessibility({ fontSize: "large" })}>A+</button>
                <button type="button" aria-pressed={a11y.fontSize === "xlarge"} onClick={() => updateAccessibility({ fontSize: "xlarge" })}>A++</button>
              </div>
            </div>

            <div className="a11y-setting">
              <span className="a11y-setting__label">Contraste</span>
              <button
                className="a11y-contrast-button"
                type="button"
                aria-pressed={a11y.contrast === "high"}
                onClick={() => updateAccessibility({ contrast: a11y.contrast === "high" ? "normal" : "high" })}
              >
                <span>Contraste renforcé</span>
                <strong>{a11y.contrast === "high" ? "Activé" : "Désactivé"}</strong>
              </button>
            </div>

            <button className="a11y-reset" type="button" onClick={resetAccessibility}>Réinitialiser</button>
          </section>
        ) : null}

        <button
          className="a11y-trigger"
          type="button"
          aria-expanded={a11yOpen}
          aria-controls="a11y-panel"
          onClick={() => setA11yOpen((value) => !value)}
        >
          <span className="a11y-trigger__icon" aria-hidden="true">♿</span>
          <span className="a11y-trigger__label">Accessibilité</span>
        </button>
      </div>
    </>
  );
}
