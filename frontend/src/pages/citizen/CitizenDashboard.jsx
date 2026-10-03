import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getCitizenRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getNews, getAlerts } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import { t, useLocale } from "../../utils/i18n.js";
import { useDataMode } from "../../utils/useDataMode.js";
import { runWhenIdle } from "../../utils/performance.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const DASH_COPY = {
  fr:{hello:"Bonjour",space:"Espace citoyen",news:"Actualités",newRequest:"Signaler un problème",banner:"Votre espace Nova Terra",headline:<>Votre ville,<br/>en un coup d’œil.</>,intro:"Suivez vos démarches et accédez aux services utiles sans chercher partout.",profile:"profil complété",open:"Démarches en cours",track:"À suivre",action:"Action requise",complete:"À compléter",pubs:"Publications disponibles",my:"MES DÉMARCHES",now:"À suivre maintenant",empty:"Aucune démarche en cours.",priority:"SERVICES PRIORITAIRES",quick:"Accès rapide",first:"PREMIÈRE CONNEXION",welcome:"Bienvenue sur Nova Terra",steps:"Trois repères pour commencer rapidement.",profileStep:"Compléter mon profil",profileText:"Coordonnées et langue préférée.",servicesStep:"Découvrir les services",servicesText:"Trouver le bon service municipal.",requestStep:"Commencer une démarche",requestText:"Envoyer puis suivre une demande.",skip:"Passer pour le moment"},
  en:{hello:"Hello",space:"Citizen space",news:"News",newRequest:"Report a problem",banner:"Your Nova Terra space",headline:<>Your city,<br/>at a glance.</>,intro:"Track your requests and access useful services without searching everywhere.",profile:"profile complete",open:"Open requests",track:"To track",action:"Action required",complete:"To complete",pubs:"Available publications",my:"MY REQUESTS",now:"Track now",empty:"No request in progress.",priority:"PRIORITY SERVICES",quick:"Quick access",first:"FIRST LOGIN",welcome:"Welcome to Nova Terra",steps:"Three quick steps to get started.",profileStep:"Complete my profile",profileText:"Contact details and preferred language.",servicesStep:"Discover services",servicesText:"Find the right city service.",requestStep:"Start a request",requestText:"Submit and track a request.",skip:"Skip for now"},
  mg:{hello:"Manao ahoana",space:"Habaka mponina",news:"Vaovao",newRequest:"Hitatitra olana",banner:"Ny habakao ao Nova Terra",headline:<>Ny tanànanao,<br/>amin'ny fijery iray.</>,intro:"Araho ny fangatahanao ary midira haingana amin'ny sampan-draharaha ilainao.",profile:"mombamomba feno",open:"Fangatahana mandeha",track:"Araho",action:"Mila hetsika",complete:"Hofenoina",pubs:"Vaovao azo jerena",my:"NY FANGATAHAKO",now:"Araho izao",empty:"Tsy misy fangatahana mandeha.",priority:"SAMPAN-DRAHARAHA LAHARAM-PAHAMEHANA",quick:"Fidirana haingana",first:"FIDIRANA VOALOHANY",welcome:"Tongasoa eto Nova Terra",steps:"Dingana telo hanombohana haingana.",profileStep:"Fenoy ny mombamomba ahy",profileText:"Fifandraisana sy fiteny tiana ampiasaina.",servicesStep:"Hijery sampan-draharaha",servicesText:"Tadiavo ny sampan-draharaha mety.",requestStep:"Hanomboka fangatahana",requestText:"Alefaso ary araho ny fangatahana.",skip:"Handalo aloha"},
};

export default function CitizenDashboard(){
  const { user } = useAuth();
  const [locale] = useLocale();
  const copy = DASH_COPY[locale] || DASH_COPY.fr;
  const dataProfile = useDataMode();
  const [citizenRequests,setCitizenRequests]=useState([]);
  const [services,setServices]=useState([]);
  const [news,setNews]=useState([]);
  const [alerts,setAlerts]=useState([]);
  const [showStartGuide,setShowStartGuide]=useState(()=>localStorage.getItem("nova_terra_first_steps_done")!=="done");

  const load = async () => {
    const [requestsData, servicesData] = await Promise.all([
      getCitizenRequests(),
      getServices(),
    ]);
    setCitizenRequests(requestsData);
    setServices(servicesData);

    const loadSecondary = async () => {
      const [newsData, alertResult] = await Promise.all([
        getNews().catch(()=>[]),
        getAlerts({page_size:20}).catch(()=>[]),
      ]);
      setNews(newsData);
      setAlerts(alertResult);
    };

    if (dataProfile.reduced) runWhenIdle(loadSecondary, 1400);
    else loadSecondary();
  };

  useEffect(()=>{
    load();
    const refresh=()=>load();
    window.addEventListener("terra-news-updated",refresh);
    window.addEventListener("terra-services-updated",refresh);
    return ()=>{
      window.removeEventListener("terra-news-updated",refresh);
      window.removeEventListener("terra-services-updated",refresh);
    };
  },[locale,dataProfile.reduced]);

  const active=useMemo(()=>citizenRequests.filter(r=>r.status!=="Terminée"),[citizenRequests]);
  const actions=useMemo(()=>citizenRequests.filter(r=>r.status==="Action requise").length,[citizenRequests]);
  const activeReports=useMemo(()=>citizenRequests.filter(r=>r.requestType==="signalement"&&!r.isClosed),[citizenRequests]);
  const visibleAlerts=useMemo(()=>[
    ...alerts.map(item=>({id:`official-${item.id||item.slug}`,kind:"official",title:item.title,detail:item.excerpt||"Information importante de la ville.",target:item.slug?`/citizen/news/${item.slug}`:"/citizen/news"})),
    ...activeReports.map(item=>({id:`report-${item.ref}`,kind:"report",title:`Alerte terrain · ${item.title}`,detail:`Votre signalement ${item.ref} est actuellement : ${item.status}.`,target:`/citizen/requests/${encodeURIComponent(item.ref)}`})),
  ].slice(0,2),[alerts,activeReports]);

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar
        eyebrow={copy.space}
        title={`${copy.hello} ${user?.first_name || user?.display_name || (locale==="mg"?"Mponina":locale==="en"?"Citizen":"Citoyen")} 👋`}
        actions={<>
          <button className="topbar-ghost" onClick={()=>navigate("/citizen/projects")}>Projets</button>
          <button className="topbar-ghost" onClick={()=>navigate("/citizen/news")}>{copy.news}</button>
          <button className="topbar-cta" onClick={()=>navigate('/citizen/signalements')}>{copy.newRequest}</button>
        </>}
      />
      <main className="portal-content citizen-dashboard">
        <section className="welcome-banner welcome-banner--compact">
          <div>
            <span>{copy.banner}</span>
            <h2>{copy.headline}</h2>
            <p>{copy.intro}</p>
          </div>
          <div className="welcome-banner__orb"><i/><b>{Math.round(([user?.first_name,user?.last_name,user?.email,user?.phone_number,user?.locale].filter(Boolean).length/5)*100)}%</b><span>{copy.profile}</span></div>
        </section>

        {showStartGuide?<section className="portal-card citizen-start-guide" aria-label={copy.first}>
          <div className="citizen-start-guide__head">
            <div><span className="section-label">{copy.first}</span><h3>{copy.welcome}</h3><p>{copy.steps}</p></div>
            <button type="button" className="guide-dismiss" onClick={()=>{localStorage.setItem("nova_terra_first_steps_done","done");setShowStartGuide(false)}}>{copy.skip}</button>
          </div>
          <div className="citizen-start-guide__steps">
            <button type="button" onClick={()=>navigate('/citizen/profile')}><i aria-hidden="true">1</i><div><strong>{copy.profileStep}</strong><span>{copy.profileText}</span></div><em aria-hidden="true">→</em></button>
            <button type="button" onClick={()=>navigate('/citizen/services')}><i aria-hidden="true">2</i><div><strong>{copy.servicesStep}</strong><span>{copy.servicesText}</span></div><em aria-hidden="true">→</em></button>
            <button type="button" onClick={()=>navigate('/citizen/requests')}><i aria-hidden="true">3</i><div><strong>{copy.requestStep}</strong><span>{copy.requestText}</span></div><em aria-hidden="true">→</em></button>
          </div>
        </section>:null}

        <section className="metric-grid metric-grid--3">
          <article><span>{copy.open}</span><strong>{active.length}</strong><small>{copy.track}</small></article>
          <article><span>{copy.action}</span><strong>{actions}</strong><small>{copy.complete}</small></article>
          <article><span>{copy.news}</span><strong>{news.length}</strong><small>{copy.pubs}</small></article>
        </section>

        {visibleAlerts.length?<section className="portal-card citizen-live-alerts" aria-label="Alertes et signalements en cours"><div className="portal-card__head"><div><span className="section-label">À surveiller</span><h3>Alertes et signalements actifs</h3></div><button onClick={()=>navigate('/citizen/services')}>Voir la carte →</button></div><div className="citizen-live-alerts__list">{visibleAlerts.map(item=><button key={item.id} onClick={()=>navigate(item.target)}><i aria-hidden="true">!</i><div><strong>{item.title}</strong><span>{item.detail}</span></div><em>{item.kind==="report"?"Signalement":"Alerte municipale"}</em></button>)}</div></section>:null}

        <section className="portal-grid portal-grid--2 citizen-dashboard__main">
          <article className="portal-card">
            <div className="portal-card__head">
              <div><span className="section-label">{copy.my}</span><h3>{copy.now}</h3></div>
              <button onClick={()=>navigate('/citizen/requests')}>{t("allRequests", locale)} →</button>
            </div>
            <div className="request-stack">
              {active.slice(0,3).map(r=><button key={r.id} onClick={()=>navigate(`/citizen/requests/${r.id}`)}>
                <div><span>{r.id}</span><strong>{r.title}</strong><small>{r.service} · {r.updated}</small></div>
                <em className={`status-pill status-${r.status.replaceAll(' ','-').toLowerCase()}`}>{r.status}</em>
              </button>)}
              {!active.length ? <div className="dashboard-empty">{copy.empty}</div> : null}
            </div>
          </article>

          <article className="portal-card">
            <div className="portal-card__head">
              <div><span className="section-label">{copy.priority}</span><h3>{copy.quick}</h3></div>
              <button onClick={()=>navigate('/citizen/services')}>{t("allServices", locale)} →</button>
            </div>
            <div className="quick-services quick-services--compact">
              {services.slice(0,6).map(s=><button key={s.slug} className={s.isAvailable===false?"is-unavailable":""} onClick={()=>navigate(`/citizen/services/${s.slug}`)}>
                <i>{s.icon}</i><span>{s.name}</span>{s.isAvailable===false?<small>Indisponible</small>:null}
              </button>)}
            </div>
          </article>
        </section>
      </main>    </div>
  </div>;
}