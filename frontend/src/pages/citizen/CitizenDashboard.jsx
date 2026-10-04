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
import "../../styles/pages/citizen-dashboard-reference.css";

const DASH_COPY = {
  fr:{
    hello:"Bonjour",space:"Espace citoyen",subtitle:"Ravie de vous revoir. Voici ce qui se passe aujourd’hui à Nova Terra.",
    news:"Actualités",projects:"Projets",newRequest:"Signaler un problème",banner:"VOTRE ESPACE NOVA TERRA",
    headline:<>Votre ville,<br/><em>en un coup d’œil.</em></>,intro:"Suivez vos démarches, accédez aux services utiles et restez informé de Nova Terra.",
    profile:"PROFIL COMPLÉTÉ",open:"DÉMARCHES OUVERTES",track:"À suivre",action:"ACTION REQUISE",complete:"À compléter",
    publications:"ACTUALITÉS",pubs:"Publications disponibles",available:"SERVICES DISPONIBLES",cityServices:"Services municipaux",
    my:"MES DÉMARCHES",now:"À suivre maintenant",empty:"Aucune démarche en cours.",priority:"SERVICES PRIORITAIRES",quick:"Accès rapide",
    first:"COMMENCER",welcome:"Bienvenue sur Nova Terra",steps:"Trois étapes rapides pour bien démarrer.",
    profileStep:"Compléter mon profil",profileText:"Coordonnées et langue préférée.",servicesStep:"Découvrir les services",servicesText:"Trouver le bon service municipal.",
    requestStep:"Commencer une démarche",requestText:"Envoyer puis suivre une demande.",skip:"Passer pour le moment",watch:"À surveiller"
  },
  en:{
    hello:"Hello",space:"Citizen space",subtitle:"Glad to see you again. Here’s what’s happening in Nova Terra today.",
    news:"News",projects:"Projects",newRequest:"Report a problem",banner:"YOUR NOVA TERRA SPACE",
    headline:<>Your city,<br/><em>at a glance.</em></>,intro:"Track your requests, access useful services and stay informed about Nova Terra.",
    profile:"PROFILE COMPLETE",open:"OPEN REQUESTS",track:"To track",action:"ACTION REQUIRED",complete:"To complete",
    publications:"NEWS",pubs:"Available publications",available:"AVAILABLE SERVICES",cityServices:"City services",
    my:"MY REQUESTS",now:"Track now",empty:"No request in progress.",priority:"PRIORITY SERVICES",quick:"Quick access",
    first:"GET STARTED",welcome:"Welcome to Nova Terra",steps:"Three quick steps to get started.",
    profileStep:"Complete my profile",profileText:"Contact details and preferred language.",servicesStep:"Discover services",servicesText:"Find the right city service.",
    requestStep:"Start a request",requestText:"Submit and track a request.",skip:"Skip for now",watch:"Watch"
  },
  mg:{
    hello:"Manao ahoana",space:"Habaka mponina",subtitle:"Faly mahita anao indray. Ireto ny zava-misy eto Nova Terra androany.",
    news:"Vaovao",projects:"Tetikasa",newRequest:"Hitatitra olana",banner:"NY HABAKAO AO NOVA TERRA",
    headline:<>Ny tanànanao,<br/><em>amin’ny fijery iray.</em></>,intro:"Araho ny fangatahanao, tadiavo haingana ny sampan-draharaha ary fantaro ny vaovao ao Nova Terra.",
    profile:"MOMBAMOMBA FENO",open:"FANGATAHANA MISOKATRA",track:"Araho",action:"MILA HETSIKA",complete:"Hofenoina",
    publications:"VAOVAO",pubs:"Vaovao azo jerena",available:"SAMPAN-DRAHARAHA MISOKATRA",cityServices:"Sampan-draharaha",
    my:"NY FANGATAHAKO",now:"Araho izao",empty:"Tsy misy fangatahana mandeha.",priority:"SAMPAN-DRAHARAHA LAHARAM-PAHAMEHANA",quick:"Fidirana haingana",
    first:"HANOMBOKA",welcome:"Tongasoa eto Nova Terra",steps:"Dingana telo hanombohana haingana.",
    profileStep:"Fenoy ny mombamomba ahy",profileText:"Fifandraisana sy fiteny tiana ampiasaina.",servicesStep:"Hijery sampan-draharaha",servicesText:"Tadiavo ny sampan-draharaha mety.",
    requestStep:"Hanomboka fangatahana",requestText:"Alefaso ary araho ny fangatahana.",skip:"Handalo aloha",watch:"Araho maso"
  },
};

const statusClass = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

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

  const active=useMemo(()=>citizenRequests.filter(r=>r.status!=="Terminée" && r.status!=="completed"),[citizenRequests]);
  const actions=useMemo(()=>citizenRequests.filter(r=>r.status==="Action requise" || r.status==="action_required").length,[citizenRequests]);
  const availableServices=useMemo(()=>services.filter(service=>service.isAvailable!==false).length,[services]);
  const activeReports=useMemo(()=>citizenRequests.filter(r=>r.requestType==="signalement"&&!r.isClosed),[citizenRequests]);
  const profileCompletion=Math.round(([user?.first_name,user?.last_name,user?.email,user?.phone_number,user?.locale].filter(Boolean).length/5)*100);
  const visibleAlerts=useMemo(()=>[
    ...alerts.map(item=>({id:`official-${item.id||item.slug}`,kind:"official",title:item.title,detail:item.excerpt||"Information importante de la ville.",target:item.slug?`/citizen/news/${item.slug}`:"/citizen/news"})),
    ...activeReports.map(item=>({id:`report-${item.ref}`,kind:"report",title:`Alerte terrain · ${item.title}`,detail:`${item.ref} · ${item.status}`,target:`/citizen/requests/${encodeURIComponent(item.ref)}`})),
  ].slice(0,1),[alerts,activeReports]);

  const firstName=user?.first_name || user?.display_name || (locale==="mg"?"Mponina":locale==="en"?"Citizen":"Citoyen");

  return <div className="portal-layout citizen-dashboard-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar
        eyebrow={copy.space}
        title={`${copy.hello} ${firstName} 👋`}
        subtitle={copy.subtitle}
        actions={<>
          <button className="topbar-icon-button" type="button" aria-label={locale==="en"?"Search services":"Rechercher dans les services"} onClick={()=>navigate("/citizen/services")}>⌕</button>
          <button className="topbar-ghost" onClick={()=>navigate("/citizen/projects")}>✦ {copy.projects}</button>
          <button className="topbar-ghost" onClick={()=>navigate("/citizen/news")}>▤ {copy.news}</button>
          <button className="topbar-cta" onClick={()=>navigate('/citizen/signalements')}>⚑ {copy.newRequest}</button>
        </>}
      />

      <main className="portal-content citizen-dashboard citizen-home">
        <section className="citizen-home-hero" aria-label={copy.banner}>
          <div className="citizen-home-hero__copy">
            <span>{copy.banner}</span>
            <h2>{copy.headline}</h2>
            <p>{copy.intro}</p>
          </div>
          <div className="citizen-home-profile-card" style={{"--profile-progress":`${profileCompletion*3.6}deg`}}>
            <div className="citizen-home-profile-ring"><strong>{profileCompletion}%</strong></div>
            <span>{copy.profile}</span>
          </div>
        </section>

        {showStartGuide?<section className="citizen-home-onboarding" aria-label={copy.first}>
          <div className="citizen-home-onboarding__head">
            <div><span>{copy.first}</span><h3>{copy.welcome}</h3><p>{copy.steps}</p></div>
            <button type="button" onClick={()=>{localStorage.setItem("nova_terra_first_steps_done","done");setShowStartGuide(false)}}>{copy.skip}</button>
          </div>
          <div className="citizen-home-onboarding__steps">
            <button type="button" onClick={()=>navigate('/citizen/profile')}><i>1</i><b>○</b><div><strong>{copy.profileStep}</strong><span>{copy.profileText}</span></div><em>›</em></button>
            <button type="button" onClick={()=>navigate('/citizen/services')}><i>2</i><b>▦</b><div><strong>{copy.servicesStep}</strong><span>{copy.servicesText}</span></div><em>›</em></button>
            <button type="button" onClick={()=>navigate('/citizen/requests')}><i>3</i><b>▤</b><div><strong>{copy.requestStep}</strong><span>{copy.requestText}</span></div><em>›</em></button>
          </div>
        </section>:null}

        <section className="citizen-home-metrics" aria-label="Résumé">
          <button type="button" onClick={()=>navigate('/citizen/requests')} className="is-purple"><i>□</i><div><span>{copy.open}</span><strong>{active.length}</strong><small>{copy.track}</small></div><em>›</em></button>
          <button type="button" onClick={()=>navigate('/citizen/requests')} className="is-orange"><i>◷</i><div><span>{copy.action}</span><strong>{actions}</strong><small>{copy.complete}</small></div><em>›</em></button>
          <button type="button" onClick={()=>navigate('/citizen/news')} className="is-blue"><i>▤</i><div><span>{copy.publications}</span><strong>{news.length}</strong><small>{copy.pubs}</small></div><em>›</em></button>
          <button type="button" onClick={()=>navigate('/citizen/services')} className="is-green"><i>▧</i><div><span>{copy.available}</span><strong>{availableServices}</strong><small>{copy.cityServices}</small></div><em>›</em></button>
        </section>

        {visibleAlerts.length?<button type="button" className="citizen-home-alert" onClick={()=>navigate(visibleAlerts[0].target)}><i>!</i><div><span>{copy.watch}</span><strong>{visibleAlerts[0].title}</strong><small>{visibleAlerts[0].detail}</small></div><em>›</em></button>:null}

        <section className="citizen-home-grid">
          <article className="citizen-home-panel">
            <div className="citizen-home-panel__head">
              <div><span>{copy.my}</span><h3>{copy.now}</h3></div>
              <button type="button" onClick={()=>navigate('/citizen/requests')}>{t("allRequests", locale)} →</button>
            </div>
            <div className="citizen-home-requests">
              {active.slice(0,3).map(r=>{
                const ref=r.ref || r.reference || r.id;
                return <button key={ref} type="button" onClick={()=>navigate(`/citizen/requests/${encodeURIComponent(ref)}`)}>
                  <i aria-hidden="true">◇</i>
                  <div><span>{ref}</span><strong>{r.title}</strong><small>{r.service || r.serviceName || "Nova Terra"} · {r.updated || r.updatedAt || ""}</small></div>
                  <em className={`status-pill status-${statusClass(r.status)}`}>{r.statusLabel || r.status}</em>
                  <b aria-hidden="true">›</b>
                </button>;
              })}
              {!active.length ? <div className="citizen-home-empty">{copy.empty}</div> : null}
            </div>
          </article>

          <article className="citizen-home-panel">
            <div className="citizen-home-panel__head">
              <div><span>{copy.priority}</span><h3>{copy.quick}</h3></div>
              <button type="button" onClick={()=>navigate('/citizen/services')}>{t("allServices", locale)} →</button>
            </div>
            <div className="citizen-home-services">
              {services.slice(0,4).map(s=><button key={s.slug} type="button" className={s.isAvailable===false?"is-unavailable":""} onClick={()=>navigate(`/citizen/services/${s.slug}`)}>
                <i>{s.icon || "◇"}</i><span>{s.name}</span>{s.isAvailable===false?<small>Indisponible</small>:null}
              </button>)}
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>;
}
