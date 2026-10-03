import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import LandingPage from "./pages/Landing/LandingPage.jsx";
import LoginPage from "./pages/Login/LoginPage.jsx";
import InscriptionPage from "./pages/Inscription/InscriptionPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPassword/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPassword/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmail/VerifyEmailPage.jsx";
import GoogleCallbackPage from "./pages/GoogleCallback/GoogleCallbackPage.jsx";
import ConfirmEmailChangePage from "./pages/ConfirmEmailChange/ConfirmEmailChangePage.jsx";
import Services from "./pages/public/Services.jsx";
import ServiceDetails from "./pages/public/ServiceDetails.jsx";
import News from "./pages/public/News.jsx";
import NewsDetails from "./pages/public/NewsDetails.jsx";
import Contact from "./pages/public/Contact.jsx";
import CitizenDashboard from "./pages/citizen/CitizenDashboard.jsx";
import CitizenProfile from "./pages/citizen/CitizenProfile.jsx";
import CitizenRequests from "./pages/citizen/CitizenRequests.jsx";
import CitizenReports from "./pages/citizen/CitizenReports.jsx";
import CitizenRequestDetails from "./pages/citizen/CitizenRequestDetails.jsx";
import CitizenServices from "./pages/citizen/CitizenServices.jsx";
import CitizenServiceDetails from "./pages/citizen/CitizenServiceDetails.jsx";
import CitizenAppointments from "./pages/citizen/CitizenAppointments.jsx";
import CitizenNotifications from "./pages/citizen/CitizenNotifications.jsx";
import CitizenNews from "./pages/citizen/CitizenNews.jsx";
import CitizenNewsDetails from "./pages/citizen/CitizenNewsDetails.jsx";
import CitizenSettings from "./pages/citizen/CitizenSettings.jsx";
import CitizenDeleteAccount from "./pages/citizen/CitizenDeleteAccount.jsx";
import CitizenHelp from "./pages/citizen/CitizenHelp.jsx";
import CitizenMessages from "./pages/citizen/CitizenMessages.jsx";
import CitizenMessageDetails from "./pages/citizen/CitizenMessageDetails.jsx";
import AgentDashboard from "./pages/agent/AgentDashboard.jsx";
import AgentRequests from "./pages/agent/AgentRequests.jsx";
import AgentReports from "./pages/agent/AgentReports.jsx";
import AgentRequestDetails from "./pages/agent/AgentRequestDetails.jsx";
import AgentAppointments from "./pages/agent/AgentAppointments.jsx";
import AgentCitizens from "./pages/agent/AgentCitizens.jsx";
import AgentCitizenDetails from "./pages/agent/AgentCitizenDetails.jsx";
import AgentApi from "./pages/agent/AgentApi.jsx";
import AgentNews from "./pages/agent/AgentNews.jsx";
import AgentServices from "./pages/agent/AgentServices.jsx";
import AgentServiceDetails from "./pages/agent/AgentServiceDetails.jsx";
import AgentNewsDetails from "./pages/agent/AgentNewsDetails.jsx";
import AgentMessages from "./pages/agent/AgentMessages.jsx";
import AgentMessageDetails from "./pages/agent/AgentMessageDetails.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminServices from "./pages/admin/AdminServices.jsx";
import AdminAppointments from "./pages/admin/AdminAppointments.jsx";
import AdminNews from "./pages/admin/AdminNews.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import AdminMessages from "./pages/admin/AdminMessages.jsx";
import AdminMessageDetails from "./pages/admin/AdminMessageDetails.jsx";
import { navigate, normalizePath, roleHome } from "./utils/navigation.js";
import { loadAccessibilityPreferences, saveAccessibilityPreferences, resetAccessibilityPreferences } from "./utils/accessibility.js";
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

function Redirect({to}) {
  useEffect(()=>navigate(to,{replace:true}),[to]);
  return null;
}

function AuthLoading(){
  return <main className="app-auth-loading" aria-label="Chargement de la session"><span/></main>;
}

function Protected({roles,children}) {
  const { ready, isAuthenticated, user } = useAuth();
  if(!ready)return <AuthLoading/>;
  if(!isAuthenticated){
    const next=encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return <Redirect to={`/login?next=${next}`}/>;
  }
  if(roles&&!roles.includes(user?.role))return <Redirect to={roleHome(user?.role)}/>;
  return children;
}

function Guest({children}) {
  const { ready, isAuthenticated, user }=useAuth();
  if(!ready)return <AuthLoading/>;
  if(isAuthenticated)return <Redirect to={roleHome(user?.role)}/>;
  return children;
}

function RoleEntry(){
  const {ready,isAuthenticated,user}=useAuth();
  if(!ready)return <AuthLoading/>;
  if(!isAuthenticated)return <Redirect to="/login"/>;
  return <Redirect to={roleHome(user?.role)}/>;
}

function internalPublicTarget(pathname, role) {
  if (!role) return null;
  if (pathname === "/" || pathname === "/landing") return roleHome(role);

  if (pathname === "/services") {
    if (role === "citizen") return "/citizen/services";
    if (role === "agent") return "/agent/services";
    if (role === "admin") return "/admin/services";
  }

  if (pathname.startsWith("/services/")) {
    const slug = pathname.split("/").filter(Boolean)[1];
    if (role === "citizen") return `/citizen/services/${encodeURIComponent(slug)}`;
    if (role === "agent") return `/agent/services/${encodeURIComponent(slug)}`;
    if (role === "admin") return "/admin/services";
  }

  if (pathname === "/news") {
    if (role === "citizen") return "/citizen/news";
    if (role === "agent") return "/agent/news";
    if (role === "admin") return "/admin/news";
  }

  if (pathname.startsWith("/news/")) {
    const slug = pathname.split("/").filter(Boolean)[1];
    if (role === "citizen") return `/citizen/news/${encodeURIComponent(slug)}`;
    if (role === "agent") return `/agent/news/${encodeURIComponent(slug)}`;
    if (role === "admin") return "/admin/news";
  }

  if (pathname === "/contact") {
    if (role === "citizen") return "/citizen/help";
    if (role === "agent") return "/agent/messages";
    if (role === "admin") return "/admin/messages";
  }

  return null;
}

function PublicOnly({ pathname, children }) {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) return <AuthLoading />;
  if (isAuthenticated) {
    const target = internalPublicTarget(pathname, user?.role);
    if (target) return <Redirect to={target} />;
  }
  return children;
}

function FallbackRoute() {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) return <AuthLoading />;
  if (isAuthenticated) return <Redirect to={roleHome(user?.role)} />;
  return <LandingPage />;
}

export default function App() {
  const pathname=useLocationPath();
  const [a11yOpen,setA11yOpen]=useState(false);
  const [a11y,setA11y]=useState(()=>loadAccessibilityPreferences());

  function updateAccessibility(patch){
    const next={...a11y,...patch};
    setA11y(next);
    saveAccessibilityPreferences(next);
  }

  function resetAccessibility(){
    const next=resetAccessibilityPreferences();
    setA11y(next);
  }

  useEffect(()=>{
    const updateViewport=()=>{
      const width=window.innerWidth;
      const height=window.innerHeight;
      document.documentElement.style.setProperty("--screen-width",`${width}px`);
      document.documentElement.style.setProperty("--screen-height",`${height}px`);
      document.documentElement.style.setProperty("--screen-ratio",String(width/Math.max(height,1)));
    };

    const isPortal=pathname.startsWith("/citizen")||pathname.startsWith("/agent")||pathname.startsWith("/admin");
    const isPublicSubpage=pathname.startsWith("/services")||pathname.startsWith("/news")||pathname==="/contact";
    const isAuth=[
      "/login","/inscription","/register","/mot-de-passe-oublie","/reset-password",
      "/verify-email","/auth/google/callback","/confirm-email-change"
    ].includes(pathname);

    document.body.dataset.routeGroup=isPortal?"portal":isPublicSubpage?"public":isAuth?"auth":"landing";
    updateViewport();
    window.addEventListener("resize",updateViewport);
    window.addEventListener("orientationchange",updateViewport);
    return()=>{
      window.removeEventListener("resize",updateViewport);
      window.removeEventListener("orientationchange",updateViewport);
    };
  },[pathname]);

  const route=useMemo(()=>{
    const routes={
      "/":<PublicOnly pathname="/"><LandingPage/></PublicOnly>,
      "/landing":<PublicOnly pathname="/landing"><LandingPage/></PublicOnly>,
      "/services":<PublicOnly pathname="/services"><Services/></PublicOnly>,
      "/news":<PublicOnly pathname="/news"><News/></PublicOnly>,
      "/contact":<PublicOnly pathname="/contact"><Contact/></PublicOnly>,

      "/login":<Guest><LoginPage/></Guest>,
      "/inscription":<Guest><InscriptionPage/></Guest>,
      "/register":<Guest><InscriptionPage/></Guest>,
      "/mot-de-passe-oublie":<Guest><ForgotPasswordPage/></Guest>,
      "/reset-password":<Guest><ResetPasswordPage/></Guest>,
      "/verify-email":<VerifyEmailPage/>,
      "/auth/google/callback":<GoogleCallbackPage/>,
      "/confirm-email-change":<ConfirmEmailChangePage/>,
      "/app":<RoleEntry/>,

      "/citizen":<Protected roles={["citizen"]}><CitizenDashboard/></Protected>,
      "/citizen/dashboard":<Protected roles={["citizen"]}><CitizenDashboard/></Protected>,
      "/citizen/profile":<Protected roles={["citizen"]}><CitizenProfile/></Protected>,
      "/citizen/requests":<Protected roles={["citizen"]}><CitizenRequests/></Protected>,
      "/citizen/signalements":<Protected roles={["citizen"]}><CitizenReports/></Protected>,
      "/citizen/services":<Protected roles={["citizen"]}><CitizenServices/></Protected>,
      "/citizen/appointments":<Protected roles={["citizen"]}><CitizenAppointments/></Protected>,
      "/citizen/news":<Protected roles={["citizen"]}><CitizenNews/></Protected>,
      "/citizen/notifications":<Protected roles={["citizen"]}><CitizenNotifications/></Protected>,
      "/citizen/settings":<Protected roles={["citizen"]}><CitizenSettings/></Protected>,
      "/citizen/supprimer-compte":<Protected roles={["citizen"]}><CitizenDeleteAccount/></Protected>,
      "/citizen/help":<Protected roles={["citizen"]}><CitizenHelp/></Protected>,
      "/citizen/messages":<Protected roles={["citizen"]}><CitizenMessages/></Protected>,

      "/agent":<Protected roles={["agent"]}><AgentDashboard/></Protected>,
      "/agent/dashboard":<Protected roles={["agent"]}><AgentDashboard/></Protected>,
      "/agent/requests":<Protected roles={["agent"]}><AgentRequests/></Protected>,
      "/agent/signalements":<Protected roles={["agent"]}><AgentReports/></Protected>,
      "/agent/appointments":<Protected roles={["agent"]}><AgentAppointments/></Protected>,
      "/agent/citizens":<Protected roles={["agent"]}><AgentCitizens/></Protected>,
      "/agent/news":<Protected roles={["agent"]}><AgentNews/></Protected>,
      "/agent/services":<Protected roles={["agent"]}><AgentServices/></Protected>,
      "/agent/api":<Protected roles={["agent"]}><AgentApi/></Protected>,
      "/agent/messages":<Protected roles={["agent"]}><AgentMessages/></Protected>,

      "/admin":<Protected roles={["admin"]}><AdminDashboard/></Protected>,
      "/admin/dashboard":<Protected roles={["admin"]}><AdminDashboard/></Protected>,
      "/admin/users":<Protected roles={["admin"]}><AdminUsers/></Protected>,
      "/admin/services":<Protected roles={["admin"]}><AdminServices/></Protected>,
      "/admin/appointments":<Protected roles={["admin"]}><AdminAppointments/></Protected>,
      "/admin/news":<Protected roles={["admin"]}><AdminNews/></Protected>,
      "/admin/settings":<Protected roles={["admin"]}><AdminSettings/></Protected>,
      "/admin/messages":<Protected roles={["admin"]}><AdminMessages/></Protected>,
    };
    if(routes[pathname])return routes[pathname];

    let params=match("/services/:slug",pathname); if(params)return <PublicOnly pathname={pathname}><ServiceDetails params={params}/></PublicOnly>;
    params=match("/news/:slug",pathname); if(params)return <PublicOnly pathname={pathname}><NewsDetails params={params}/></PublicOnly>;
    params=match("/citizen/services/:slug",pathname); if(params)return <Protected roles={["citizen"]}><CitizenServiceDetails params={params}/></Protected>;
    params=match("/citizen/requests/:id",pathname); if(params)return <Protected roles={["citizen"]}><CitizenRequestDetails params={params}/></Protected>;
    params=match("/citizen/news/:slug",pathname); if(params)return <Protected roles={["citizen"]}><CitizenNewsDetails params={params}/></Protected>;
    params=match("/citizen/messages/:id",pathname); if(params)return <Protected roles={["citizen"]}><CitizenMessageDetails params={params}/></Protected>;
    params=match("/agent/services/:slug",pathname); if(params)return <Protected roles={["agent"]}><AgentServiceDetails params={params}/></Protected>;
    params=match("/agent/news/:slug",pathname); if(params)return <Protected roles={["agent"]}><AgentNewsDetails params={params}/></Protected>;
    params=match("/agent/requests/:id",pathname); if(params)return <Protected roles={["agent"]}><AgentRequestDetails params={params}/></Protected>;
    params=match("/agent/citizens/:id",pathname); if(params)return <Protected roles={["agent"]}><AgentCitizenDetails params={params}/></Protected>;
    params=match("/agent/messages/:id",pathname); if(params)return <Protected roles={["agent"]}><AgentMessageDetails params={params}/></Protected>;
    params=match("/admin/messages/:id",pathname); if(params)return <Protected roles={["admin"]}><AdminMessageDetails params={params}/></Protected>;

    return <FallbackRoute/>;
  },[pathname]);

  return <>
    <a className="skip-link" href="#main-content">Aller au contenu principal</a>

    <div id="main-content" tabIndex="-1" className="app-route-content">{route}</div>

    <div className="a11y-dock">
      {a11yOpen?<section className="a11y-panel" id="a11y-panel" role="dialog" aria-modal="false" aria-labelledby="a11y-title">
        <div className="a11y-panel__head">
          <div><strong id="a11y-title">Accessibilité</strong><span>Affichage adapté à vos besoins</span></div>
          <button className="a11y-panel__close" type="button" aria-label="Fermer les réglages d’accessibilité" onClick={()=>setA11yOpen(false)}>×</button>
        </div>

        <div className="a11y-setting">
          <span className="a11y-setting__label">Taille du texte</span>
          <div className="a11y-size-buttons" role="group" aria-label="Taille du texte">
            <button type="button" aria-pressed={a11y.fontSize==="normal"} onClick={()=>updateAccessibility({fontSize:"normal"})}>A</button>
            <button type="button" aria-pressed={a11y.fontSize==="large"} onClick={()=>updateAccessibility({fontSize:"large"})}>A+</button>
            <button type="button" aria-pressed={a11y.fontSize==="xlarge"} onClick={()=>updateAccessibility({fontSize:"xlarge"})}>A++</button>
          </div>
        </div>

        <div className="a11y-setting">
          <span className="a11y-setting__label">Espacement des caractères</span>
          <div className="a11y-spacing-buttons" role="group" aria-label="Espacement des caractères">
            <button type="button" aria-pressed={a11y.characterSpacing==="normal"} onClick={()=>updateAccessibility({characterSpacing:"normal"})}>Normal</button>
            <button type="button" aria-pressed={a11y.characterSpacing==="wide"} onClick={()=>updateAccessibility({characterSpacing:"wide"})}>+ Espacé</button>
            <button type="button" aria-pressed={a11y.characterSpacing==="xwide"} onClick={()=>updateAccessibility({characterSpacing:"xwide"})}>++ Espacé</button>
          </div>
        </div>

        <div className="a11y-setting">
          <span className="a11y-setting__label">Contraste</span>
          <button className="a11y-contrast-button" type="button" aria-pressed={a11y.contrast==="high"} onClick={()=>updateAccessibility({contrast:a11y.contrast==="high"?"normal":"high"})}>
            <span>Contraste renforcé</span><strong>{a11y.contrast==="high"?"Activé":"Désactivé"}</strong>
          </button>
        </div>

        <button className="a11y-reset" type="button" onClick={resetAccessibility}>Réinitialiser</button>
      </section>:null}

      <button className="a11y-trigger" type="button" aria-expanded={a11yOpen} aria-controls="a11y-panel" onClick={()=>setA11yOpen(value=>!value)}>
        <span className="a11y-trigger__icon" aria-hidden="true">♿</span>
        <span className="a11y-trigger__label">Accessibilité</span>
      </button>
    </div>
  </>;
}
