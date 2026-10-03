import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getNews } from "../../api/news.js";
import { getLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenNews(){
  const { user }=useAuth();
  const locale=user?.locale||getLocale();
  const [items,setItems]=useState([]);
  const [filter,setFilter]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    setLoading(true);setError("");
    getNews()
      .then(data=>mounted&&setItems(data))
      .catch(()=>mounted&&setError(locale==="en"?"Unable to load news.":"Impossible de charger les actualités."))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[locale]);

  const filters=useMemo(()=>["Toutes",...Array.from(new Set(items.map(item=>item.category).filter(Boolean)))],[items]);
  const visible=useMemo(()=>items.filter(item=>filter==="Toutes"||item.category===filter),[items,filter]);

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={locale==="en"?"CITY INFORMATION":"INFORMATIONS MUNICIPALES"} title={locale==="en"?"News":"Actualités"}/>
      <main className="portal-content citizen-news-page">
        {loading?<div className="loading-card">{locale==="en"?"Loading…":"Chargement…"}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <section className="citizen-news-intro">
          <div>
            <span className="section-label">{locale==="en"?"NOVA TERRA TODAY":"NOVA TERRA AUJOURD’HUI"}</span>
            <h2>{locale==="en"?<>Useful information,<br/>in one place.</>:<>Les informations utiles,<br/>au même endroit.</>}</h2>
          </div>
          <p>{locale==="en"?"City announcements, service changes and practical information for residents.":"Annonces municipales, changements de service et informations pratiques publiés pour les habitants."}</p>
        </section>

        <div className="filter-row filter-row--portal citizen-news-filters">
          {filters.map(item=><button key={item} className={filter===item?"is-active":""} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{locale==="en"&&item==="Toutes"?"All":item}</button>)}
        </div>

        <section className="citizen-news-grid">
          {visible.map((item,index)=><article className={index===0?"citizen-news-card is-featured":"citizen-news-card"} key={item.slug}>
            <button className="citizen-news-card__image" onClick={()=>navigate(`/citizen/news/${item.slug}`)} aria-label={`${locale==="en"?"Read":"Lire"} ${item.title}`}>
              <img src={item.image} alt={`Illustration : ${item.title}`} />
              <span>{item.kind || item.category}</span>
            </button>
            <div>
              <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
              <button className="news-read-link" onClick={()=>navigate(`/citizen/news/${item.slug}`)}>{locale==="en"?"Read":"Lire"} →</button>
            </div>
          </article>)}
        </section>
      </main>
    </div>
  </div>;
}
