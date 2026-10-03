import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNews } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY={
  fr:{eyebrow:"Informations municipales",title:"Actualités",kicker:"Nova Terra aujourd’hui",headline:<>Les informations utiles,<br/>au même endroit.</>,intro:"Annonces municipales, changements de service et informations pratiques publiés pour les habitants.",all:"Toutes",read:"Lire",loading:"Chargement…",error:"Impossible de charger les actualités."},
  en:{eyebrow:"City information",title:"News",kicker:"Nova Terra today",headline:<>Useful information,<br/>in one place.</>,intro:"City announcements, service changes and practical information for residents.",all:"All",read:"Read",loading:"Loading…",error:"Unable to load news."},
  mg:{eyebrow:"Vaovaon'ny tanàna",title:"Vaovao",kicker:"Nova Terra androany",headline:<>Vaovao ilaina,<br/>amin'ny toerana iray.</>,intro:"Filazana avy amin'ny tanàna, fiovan'ny sampan-draharaha ary vaovao ilaina ho an'ny mponina.",all:"Rehetra",read:"Hamaky",loading:"Mampiditra…",error:"Tsy afaka mampiseho ny vaovao."}
};

export default function CitizenNews(){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]);
  const [filter,setFilter]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    getNews().then(data=>active&&setItems(data)).catch(()=>active&&setError(copy.error)).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[locale]);

  const filters=useMemo(()=>["Toutes",...Array.from(new Set(items.map(item=>item.category).filter(Boolean)))],[items]);
  const visible=useMemo(()=>items.filter(item=>filter==="Toutes"||item.category===filter),[items,filter]);

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

        <div className="filter-row filter-row--portal citizen-news-filters">
          {filters.map(item=><button key={item} className={filter===item?"is-active":""} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item==="Toutes"?copy.all:item}</button>)}
        </div>

        <section className="citizen-news-grid">
          {visible.map((item,index)=><article className={index===0?"citizen-news-card is-featured":"citizen-news-card"} key={item.slug}>
            <button className="citizen-news-card__image" onClick={()=>navigate(`/citizen/news/${item.slug}`)} aria-label={`${copy.read} ${item.title}`}>
              <img src={item.image} alt={`Illustration : ${item.title}`} />
              <span>{item.kind || item.category}</span>
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
