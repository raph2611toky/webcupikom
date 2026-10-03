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
import CitizenSettings from "./pages/citizen/CitizenSettings.jsx";
import AgentDashboard from "./pages/agent/AgentDashboard.jsx";
import AgentRequests from "./pages/agent/AgentRequests.jsx";
import AgentRequestDetails from "./pages/agent/AgentRequestDetails.jsx";
import AgentCitizens from "./pages/agent/AgentCitizens.jsx";
import AgentCitizenDetails from "./pages/agent/AgentCitizenDetails.jsx";
import AgentApi from "./pages/agent/AgentApi.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminServices from "./pages/admin/AdminServices.jsx";
import AdminNews from "./pages/admin/AdminNews.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import { getSession, navigate, roleHome } from "./utils/navigation.js";
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
      "/citizen/notifications": <Protected roles={["citizen"]}><CitizenNotifications /></Protected>,
      "/citizen/settings": <Protected roles={["citizen"]}><CitizenSettings /></Protected>,
      "/agent": <Protected roles={["agent"]}><AgentDashboard /></Protected>,
      "/agent/dashboard": <Protected roles={["agent"]}><AgentDashboard /></Protected>,
      "/agent/requests": <Protected roles={["agent"]}><AgentRequests /></Protected>,
      "/agent/citizens": <Protected roles={["agent"]}><AgentCitizens /></Protected>,
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
    params = match("/agent/requests/:id", pathname); if (params) return <Protected roles={["agent"]}><AgentRequestDetails params={params} /></Protected>;
    params = match("/agent/citizens/:id", pathname); if (params) return <Protected roles={["agent"]}><AgentCitizenDetails params={params} /></Protected>;
    if (pathname === "/app") {
      const session = getSession();
      if (session) { navigate(roleHome(session.role), { replace: true }); return null; }
      navigate("/login", { replace: true }); return null;
    }
    return <LandingPage />;
  }, [pathname]);
  return route;
}
