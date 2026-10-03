import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import LandingPage from "./pages/Landing/LandingPage.jsx";
import LoginPage from "./pages/Login/LoginPage.jsx";
import InscriptionPage from "./pages/Inscription/InscriptionPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPassword/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPassword/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmail/VerifyEmailPage.jsx";
import GoogleCallbackPage from "./pages/GoogleCallback/GoogleCallbackPage.jsx";
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
import { navigate, normalizePath, roleHome } from "./utils/navigation.js";
import "./styles/app-shell.css";

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

function Redirect({ to }) {
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to]);
  return null;
}

function AuthLoading() {
  return (
    <main className="app-auth-loading" aria-label="Chargement de la session">
      <span />
    </main>
  );
}

function Protected({ role, children }) {
  const { ready, isAuthenticated, user } = useAuth();

  if (!ready) return <AuthLoading />;
  if (!isAuthenticated) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return <Redirect to={`/login?next=${next}`} />;
  }

  if (role && user?.role !== role) {
    return <Redirect to={roleHome(user?.role)} />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) return <AuthLoading />;
  if (isAuthenticated) return <Redirect to={roleHome(user?.role)} />;
  return children;
}

function RoleEntry() {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) return <AuthLoading />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Redirect to={roleHome(user?.role)} />;
}

export default function App() {
  const pathname = useLocationPath();

  const staticRoutes = {
    "/": <LandingPage />,
    "/landing": <LandingPage />,
    "/services": <Services />,
    "/news": <News />,
    "/contact": <Contact />,
    "/login": <GuestRoute><LoginPage /></GuestRoute>,
    "/inscription": <GuestRoute><InscriptionPage /></GuestRoute>,
    "/register": <GuestRoute><InscriptionPage /></GuestRoute>,
    "/mot-de-passe-oublie": <GuestRoute><ForgotPasswordPage /></GuestRoute>,
    "/reset-password": <GuestRoute><ResetPasswordPage /></GuestRoute>,
    "/verify-email": <VerifyEmailPage />,
    "/auth/google/callback": <GoogleCallbackPage />,
    "/app": <RoleEntry />,

    "/citizen": <Protected role="citizen"><CitizenDashboard /></Protected>,
    "/citizen/dashboard": <Protected role="citizen"><CitizenDashboard /></Protected>,
    "/citizen/profile": <Protected role="citizen"><CitizenProfile /></Protected>,
    "/citizen/requests": <Protected role="citizen"><CitizenRequests /></Protected>,
    "/citizen/services": <Protected role="citizen"><CitizenServices /></Protected>,
    "/citizen/notifications": <Protected role="citizen"><CitizenNotifications /></Protected>,
    "/citizen/settings": <Protected role="citizen"><CitizenSettings /></Protected>,

    "/agent": <Protected role="agent"><AgentDashboard /></Protected>,
    "/agent/dashboard": <Protected role="agent"><AgentDashboard /></Protected>,
    "/agent/requests": <Protected role="agent"><AgentRequests /></Protected>,
    "/agent/citizens": <Protected role="agent"><AgentCitizens /></Protected>,
    "/agent/api": <Protected role="agent"><AgentApi /></Protected>,

    "/admin": <Protected role="admin"><AdminDashboard /></Protected>,
    "/admin/dashboard": <Protected role="admin"><AdminDashboard /></Protected>,
    "/admin/users": <Protected role="admin"><AdminUsers /></Protected>,
    "/admin/services": <Protected role="admin"><AdminServices /></Protected>,
    "/admin/news": <Protected role="admin"><AdminNews /></Protected>,
    "/admin/settings": <Protected role="admin"><AdminSettings /></Protected>,
  };

  if (staticRoutes[pathname]) return staticRoutes[pathname];

  let params = match("/services/:slug", pathname);
  if (params) return <ServiceDetails params={params} />;

  params = match("/news/:slug", pathname);
  if (params) return <NewsDetails params={params} />;

  params = match("/citizen/requests/:id", pathname);
  if (params) return <Protected role="citizen"><CitizenRequestDetails params={params} /></Protected>;

  params = match("/agent/requests/:id", pathname);
  if (params) return <Protected role="agent"><AgentRequestDetails params={params} /></Protected>;

  params = match("/agent/citizens/:id", pathname);
  if (params) return <Protected role="agent"><AgentCitizenDetails params={params} /></Protected>;

  return <LandingPage />;
}
