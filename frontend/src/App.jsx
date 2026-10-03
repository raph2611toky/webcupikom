import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { navigate, normalizePath, roleHome } from "./utils/navigation.js";
import { loadAccessibilityPreferences, saveAccessibilityPreferences, resetAccessibilityPreferences } from "./utils/accessibility.js";
import { useDataMode } from "./utils/useDataMode.js";
import { setDataModePreference } from "./utils/performance.js";
import "./styles/app-core.css";

const LandingPage = lazy(() => import("./pages/Landing/LandingPage.jsx"));
const LoginPage = lazy(() => import("./pages/Login/LoginPage.jsx"));
const InscriptionPage = lazy(() => import("./pages/Inscription/InscriptionPage.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword/ForgotPasswordPage.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword/ResetPasswordPage.jsx"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmail/VerifyEmailPage.jsx"));
const GoogleCallbackPage = lazy(() => import("./pages/GoogleCallback/GoogleCallbackPage.jsx"));
const ConfirmEmailChangePage = lazy(() => import("./pages/ConfirmEmailChange/ConfirmEmailChangePage.jsx"));

const Services = lazy(() => import("./pages/public/Services.jsx"));
const ServiceDetails = lazy(() => import("./pages/public/ServiceDetails.jsx"));
const News = lazy(() => import("./pages/public/News.jsx"));
const NewsDetails = lazy(() => import("./pages/public/NewsDetails.jsx"));
const Contact = lazy(() => import("./pages/public/Contact.jsx"));

const CitizenDashboard = lazy(() => import("./pages/citizen/CitizenDashboard.jsx"));
const CitizenProfile = lazy(() => import("./pages/citizen/CitizenProfile.jsx"));
const CitizenRequests = lazy(() => import("./pages/citizen/CitizenRequests.jsx"));
const CitizenReports = lazy(() => import("./pages/citizen/CitizenReports.jsx"));
const CitizenRequestDetails = lazy(() => import("./pages/citizen/CitizenRequestDetails.jsx"));
const CitizenServices = lazy(() => import("./pages/citizen/CitizenServices.jsx"));
const CitizenServiceDetails = lazy(() => import("./pages/citizen/CitizenServiceDetails.jsx"));
const CitizenAppointments = lazy(() => import("./pages/citizen/CitizenAppointments.jsx"));
const CitizenNotifications = lazy(() => import("./pages/citizen/CitizenNotifications.jsx"));
const CitizenNews = lazy(() => import("./pages/citizen/CitizenNews.jsx"));
const CitizenNewsDetails = lazy(() => import("./pages/citizen/CitizenNewsDetails.jsx"));
const CitizenSettings = lazy(() => import("./pages/citizen/CitizenSettings.jsx"));
const CitizenDeleteAccount = lazy(() => import("./pages/citizen/CitizenDeleteAccount.jsx"));
const CitizenHelp = lazy(() => import("./pages/citizen/CitizenHelp.jsx"));
const CitizenMessages = lazy(() => import("./pages/citizen/CitizenMessages.jsx"));
const CitizenMessageDetails = lazy(() => import("./pages/citizen/CitizenMessageDetails.jsx"));
const CitizenProjects = lazy(() => import("./pages/citizen/CitizenProjects.jsx"));
const CitizenProjectDetails = lazy(() => import("./pages/citizen/CitizenProjectDetails.jsx"));

const AgentDashboard = lazy(() => import("./pages/agent/AgentDashboard.jsx"));
const AgentRequests = lazy(() => import("./pages/agent/AgentRequests.jsx"));
const AgentReports = lazy(() => import("./pages/agent/AgentReports.jsx"));
const AgentRequestDetails = lazy(() => import("./pages/agent/AgentRequestDetails.jsx"));
const AgentAppointments = lazy(() => import("./pages/agent/AgentAppointments.jsx"));
const AgentCitizens = lazy(() => import("./pages/agent/AgentCitizens.jsx"));
const AgentCitizenDetails = lazy(() => import("./pages/agent/AgentCitizenDetails.jsx"));
const AgentApi = lazy(() => import("./pages/agent/AgentApi.jsx"));
const AgentNews = lazy(() => import("./pages/agent/AgentNews.jsx"));
const AgentServices = lazy(() => import("./pages/agent/AgentServices.jsx"));
const AgentServiceDetails = lazy(() => import("./pages/agent/AgentServiceDetails.jsx"));
const AgentNewsDetails = lazy(() => import("./pages/agent/AgentNewsDetails.jsx"));
const AgentMessages = lazy(() => import("./pages/agent/AgentMessages.jsx"));
const AgentMessageDetails = lazy(() => import("./pages/agent/AgentMessageDetails.jsx"));
const AgentAudit = lazy(() => import("./pages/agent/AgentAudit.jsx"));
const AgentProjects = lazy(() => import("./pages/agent/AgentProjects.jsx"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices.jsx"));
const AdminAppointments = lazy(() => import("./pages/admin/AdminAppointments.jsx"));
const AdminNews = lazy(() => import("./pages/admin/AdminNews.jsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.jsx"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages.jsx"));
const AdminMessageDetails = lazy(() => import("./pages/admin/AdminMessageDetails.jsx"));

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

function RouteLoading(){
  return <main className="app-route-loading" role="status" aria-live="polite"><span aria-hidden="true"/><p>Chargement de cette page…</p></main>;
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
  const dataProfile=useDataMode();

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
      "/citizen/projects":<Protected roles={["citizen"]}><CitizenProjects/></Protected>,

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
      "/agent/audit":<Protected roles={["agent"]}><AgentAudit/></Protected>,
      "/agent/projects":<Protected roles={["agent"]}><AgentProjects/></Protected>,

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
    params=match("/citizen/projects/:id",pathname); if(params)return <Protected roles={["citizen"]}><CitizenProjectDetails params={params}/></Protected>;
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

    <div id="main-content" tabIndex="-1" className="app-route-content"><Suspense fallback={<RouteLoading/>}>{route}</Suspense></div>

    {dataProfile.reduced?<div className="data-saver-indicator" role="status" aria-live="polite"><div><strong>Mode léger / simplifié actif</strong><span>{dataProfile.reason}. Animations, médias et effets non essentiels sont réduits.</span></div><button type="button" onClick={()=>setDataModePreference("full")}>Version complète</button></div>:null}

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
