import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getCitizenDashboard } from "../../api/dashboards.js";
import { getCitizenRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getNews } from "../../api/news.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { getLocale, syncLocaleFromUser, t } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function profileCompletion(user) {
  const fields = [user?.first_name, user?.last_name, user?.email, user?.phone_number, user?.locale];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function CitizenDashboard(){
  const { user } = useAuth();
  const [summary,setSummary]=useState(null);
  const [requests,setRequests]=useState([]);
  const [services,setServices]=useState([]);
  const [news,setNews]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [onboarding,setOnboarding]=useState(false);
  const locale = user?.locale || getLocale();

  useEffect(()=>{
    syncLocaleFromUser(user);
    const key = user?.id ? `nova_terra_onboarding_${user.id}` : "nova_terra_onboarding_guest";
    setOnboarding(window.localStorage.getItem(key) !== "done");

    let mounted=true;
    Promise.allSettled([getCitizenDashboard(),getCitizenRequests(),getServices(),getNews()]).then((results)=>{
      if(!mounted)return;
      const [dashboardResult, requestsResult, servicesResult, newsResult] = results;
      if(dashboardResult.status==="fulfilled") setSummary(dashboardResult.value);
      if(requestsResult.status==="fulfilled") setRequests(requestsResult.value);
      if(servicesResult.status==="fulfilled") setServices(servicesResult.value);
      if(newsResult.status==="fulfilled") setNews(newsResult.value);

      const rejected = results.find((item)=>item.status==="rejected");
      if(rejected && requestsResult.status==="rejected" && servicesResult.status==="rejected"){
        setError(getApiErrorMessage(rejected.reason,"Impossible de charger votre espace citoyen."));
      }
      setLoading(false);
    });
    return()=>{mounted=false};
  },[user?.id,user?.locale]);

  const active=useMemo(()=>requests.filter(r=>r.statusCode!=="completed"),[requests]);
  const actionRequired=useMemo(()=>requests.filter(r=>r.statusCode==="action_required").length,[requests]);
  const stats=summary?.requests||{};
  const inProgress=stats.pending!==undefined
    ? (stats.pending||0)+(stats.submitted||0)+(stats.in_progress||0)
    : active.length;
  const completion=profileCompletion(user);

  function finishOnboarding(to){
    const key = user?.id ? `nova_terra_onboarding_${user.id}` : "nova_terra_onboarding_guest";
    window.localStorage.setItem(key,"done");
    setOnboarding(false);
    if(to) navigate(to);
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar
        eyebrow={t("citizenSpace",locale)}
        title={`${locale==="en"?"Hello":"Bonjour"} ${user?.first_name || user?.display_name || "Citoyen"} 👋`}
        actions={<>
          <button className="topbar-ghost" onClick={()=>navigate("/citizen/news")}>{t("news",locale)}</button>
          <button className="topbar-cta" onClick={()=>navigate("/citizen/requests?new=1")}>{t("newRequest",locale)}</button>
        </>}
      />

      <main className="portal-content citizen-dashboard">
        {loading?<div className="loading-card">{t("loading",locale)}</div>:null}
        {error?<div className="error-card">{error}</div>:null}

        {!loading?<>
          <section className="welcome-banner welcome-banner--compact">
            <div>
              <span>{locale==="en"?"YOUR NOVA TERRA SPACE":"VOTRE ESPACE NOVA TERRA"}</span>
              <h2>{locale==="en"?<>Your city,<br/>at a glance.</>:<>Votre ville,<br/>en un coup d’œil.</>}</h2>
              <p>{locale==="en"?"Track your requests and access useful services without searching everywhere.":"Suivez vos démarches et accédez aux services utiles sans chercher partout."}</p>
            </div>
            <div className="welcome-banner__orb"><i/><b>{completion}%</b><span>{locale==="en"?"PROFILE COMPLETE":"PROFIL COMPLÉTÉ"}</span></div>
          </section>

          <section className="metric-grid metric-grid--3">
            <article><span>{t("currentRequests",locale)}</span><strong>{inProgress}</strong><small>{locale==="en"?"To track":"À suivre"}</small></article>
            <article><span>{t("actionRequired",locale)}</span><strong>{stats.action_required ?? actionRequired}</strong><small>{locale==="en"?"To complete":"À compléter"}</small></article>
            <article><span>{t("latestNews",locale)}</span><strong>{news.length}</strong><small>{locale==="en"?"Available publications":"Publications disponibles"}</small></article>
          </section>

          <section className="portal-grid portal-grid--2 citizen-dashboard__main">
            <article className="portal-card">
              <div className="portal-card__head">
                <div><span className="section-label">{t("requests",locale)}</span><h3>{t("followNow",locale)}</h3></div>
                <button onClick={()=>navigate("/citizen/requests")}>{t("allRequests",locale)} →</button>
              </div>
              <div className="request-stack">
                {active.slice(0,3).map(r=><button key={r.id} onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(r.id)}`)}>
                  <div><span>{r.id}</span><strong>{r.title}</strong><small>{r.service} · {r.updated}</small></div>
                  <em className={`status-pill status-${String(r.status).replaceAll(" ","-").toLowerCase()}`}>{r.status}</em>
                </button>)}
                {!active.length?<div className="dashboard-empty">{locale==="en"?"No request in progress.":"Aucune démarche en cours."}</div>:null}
              </div>
            </article>

            <article className="portal-card">
              <div className="portal-card__head">
                <div><span className="section-label">{t("quickServices",locale)}</span><h3>{locale==="en"?"Direct access":"Accès direct"}</h3></div>
                <button onClick={()=>navigate("/citizen/services")}>{t("allServices",locale)} →</button>
              </div>
              <div className="quick-services quick-services--compact">
                {services.slice(0,6).map(s=><button key={s.slug} onClick={()=>navigate(`/services/${s.slug}`)}>
                  <i aria-hidden="true">{s.icon}</i><span>{s.name}</span>
                </button>)}
              </div>
            </article>
          </section>
        </>:null}
      </main>

      {onboarding ? <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <section className="onboarding-card">
          <button className="modal-close" type="button" aria-label="Fermer" onClick={()=>finishOnboarding()}>×</button>
          <span className="section-label">{locale==="en"?"FIRST LOGIN":"PREMIÈRE CONNEXION"}</span>
          <h2 id="onboarding-title">{locale==="en"?"Welcome to Nova Terra":"Bienvenue sur Nova Terra"}</h2>
          <p>{locale==="en"?"Three quick steps to get started.":"Trois étapes simples pour prendre rapidement vos repères."}</p>

          <div className="onboarding-steps">
            <button type="button" onClick={()=>finishOnboarding("/citizen/profile")}><i>01</i><div><b>{locale==="en"?"Complete your profile":"Compléter votre profil"}</b><span>{locale==="en"?"Add your contact details and preferred language.":"Ajoutez vos coordonnées et votre langue préférée."}</span></div><em>→</em></button>
            <button type="button" onClick={()=>finishOnboarding("/citizen/services")}><i>02</i><div><b>{locale==="en"?"Find a city service":"Trouver un service"}</b><span>{locale==="en"?"Discover the municipal services available to you.":"Découvrez les services municipaux disponibles."}</span></div><em>→</em></button>
            <button type="button" onClick={()=>finishOnboarding("/citizen/requests?new=1")}><i>03</i><div><b>{locale==="en"?"Start a request":"Commencer une démarche"}</b><span>{locale==="en"?"Submit a request and track its progress.":"Envoyez une demande et suivez son avancement."}</span></div><em>→</em></button>
          </div>

          <button className="onboarding-skip" type="button" onClick={()=>finishOnboarding()}>{locale==="en"?"Skip for now":"Passer pour le moment"}</button>
        </section>
      </div>:null}
    </div>
  </div>;
}
