import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNews } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
import { useDataMode } from "../../utils/useDataMode.js";

const COPY={
  fr:{eyebrow:"Informations municipales",title:"Actualités",kicker:"Nova Terra aujourd’hui",headline:<>Les informations utiles,<br/>au même endroit.</>,intro:"Annonces municipales, changements de service et informations pratiques publiés pour les habitants.",all:"Toutes",read:"Lire",loading:"Chargement…",error:"Impossible de charger les actualités."},
  en:{eyebrow:"City information",title:"News",kicker:"Nova Terra today",headline:<>Useful information,<br/>in one place.</>,intro:"City announcements, service changes and practical information for residents.",all:"All",read:"Read",loading:"Loading…",error:"Unable to load news."},
  mg:{eyebrow:"Vaovaon'ny tanàna",title:"Vaovao",kicker:"Nova Terra androany",headline:<>Vaovao ilaina,<br/>amin'ny toerana iray.</>,intro:"Filazana avy amin'ny tanàna, fiovan'ny sampan-draharaha ary vaovao ilaina ho an'ny mponina.",all:"Rehetra",read:"Hamaky",loading:"Mampiditra…",error:"Tsy afaka mampiseho ny vaovao."}
};

export default function CitizenNews(){
  const dataProfile=useDataMode();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]);
  const initialType=new URLSearchParams(window.location.search).get("type")||"all";
  const [typeFilter,setTypeFilter]=useState(["news","announcement","alert"].includes(initialType)?initialType:"all");
  const [filter,setFilter]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    getNews().then(data=>active&&setItems(data)).catch(()=>active&&setError(copy.error)).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[locale]);

  useEffect(()=>{
    const syncType=()=>{
      const value=new URLSearchParams(window.location.search).get("type")||"all";
      setTypeFilter(["news","announcement","alert"].includes(value)?value:"all");
      setFilter("Toutes");
    };
    window.addEventListener("popstate",syncType);
    return()=>window.removeEventListener("popstate",syncType);
  },[]);

  const typeOptions=[["all","Toutes"],["news","Actualités"],["announcement","Annonces"],["alert","Alertes"]];
  const typeVisible=useMemo(()=>items.filter(item=>typeFilter==="all"||(item.publication_type||item.publicationType)===typeFilter),[items,typeFilter]);
  const filters=useMemo(()=>["Toutes",...Array.from(new Set(typeVisible.map(item=>item.category).filter(Boolean)))],[typeVisible]);
  const visible=useMemo(()=>typeVisible.filter(item=>filter==="Toutes"||item.category===filter),[typeVisible,filter]);

  function chooseType(value){
    setTypeFilter(value);
    setFilter("Toutes");
    const url=value==="all"?"/citizen/news":`/citizen/news?type=${encodeURIComponent(value)}`;
    window.history.replaceState({},"",url);
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
      <main className="portal-content citizen-news-page">
        {loading?<div className="loading-card">{copy.loading}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <section className="citizen-news-intro">
          <div><span className="section-label">{copy.kicker}</span><h2>{copy.headline}</h2></div>
          <p>{copy.intro}</p>
        </section>

        <div className="filter-row filter-row--portal citizen-news-type-filters" aria-label="Type de publication">
          {typeOptions.map(([value,label])=><button key={value} className={typeFilter===value?"is-active":""} aria-pressed={typeFilter===value} onClick={()=>chooseType(value)}>{value==="all"?copy.all:label}</button>)}
        </div>

        <div className="filter-row filter-row--portal citizen-news-filters" aria-label="Catégorie">
          {filters.map(item=><button key={item} className={filter===item?"is-active":""} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item==="Toutes"?copy.all:item}</button>)}
        </div>

        <section className="citizen-news-grid">
          {!loading&&!visible.length?<div className="portal-card citizen-news-empty" role="status"><strong>{typeFilter==="alert"?"Aucune alerte municipale active.":"Aucune publication pour ce filtre."}</strong><span>{typeFilter==="alert"?"Les alertes publiées par l’administration apparaîtront ici automatiquement.":"Essayez un autre type ou une autre catégorie."}</span></div>:null}
          {visible.map((item,index)=><article className={index===0?"citizen-news-card is-featured":"citizen-news-card"} key={item.slug}>
            <button className="citizen-news-card__image" onClick={()=>navigate(`/citizen/news/${item.slug}`)} aria-label={`${copy.read} ${item.title}`}>
              {dataProfile.reduced?<span className="media-light-placeholder" aria-label={`Illustration différée : ${item.title}`}>Image différée</span>:<img src={item.image} alt={`Illustration : ${item.title}`} loading={index===0?"eager":"lazy"} decoding="async" fetchPriority={index===0?"high":"low"} width="960" height="540" />}
              <span>{(item.publication_type||item.publicationType)==="alert"?"Alerte":(item.publication_type||item.publicationType)==="announcement"?"Annonce":"Actualité"}</span>
            </button>
            <div>
              <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
              <h3>{item.title}</h3><p>{item.excerpt}</p>
              <button className="news-read-link" onClick={()=>navigate(`/citizen/news/${item.slug}`)}>{copy.read} →</button>
            </div>
          </article>)}
        </section>
      </main>
    </div>
  </div>;
}
