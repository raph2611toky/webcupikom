import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNews } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";
import { useDataMode } from "../../utils/useDataMode.js";

const COPY={
  fr:{kicker:"Actualités municipales",title:<>Les informations de <em>Nova Terra.</em></>,intro:"Annonces, changements de service et informations pratiques publiés par la ville.",all:"Toutes",read:"Lire l’actualité",loading:"Chargement des actualités…",error:"Impossible de charger les actualités."},
  en:{kicker:"City news",title:<>Nova Terra <em>news.</em></>,intro:"Announcements, service changes and practical information published by the city.",all:"All",read:"Read article",loading:"Loading news…",error:"Unable to load news."},
  mg:{kicker:"Vaovaon'ny tanàna",title:<>Vaovao avy amin'i <em>Nova Terra.</em></>,intro:"Filazana, fiovan'ny sampan-draharaha ary vaovao ilaina avoakan'ny tanàna.",all:"Rehetra",read:"Hamaky",loading:"Mampiditra vaovao…",error:"Tsy afaka mampiseho ny vaovao."}
};

export default function News(){
  const dataProfile=useDataMode();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]);
  const [category,setCategory]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    getNews().then(data=>active&&setItems(data)).catch(()=>active&&setError(copy.error)).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[locale]);

  const categories=useMemo(()=>["Toutes",...Array.from(new Set(items.map(n=>n.category).filter(Boolean)))],[items]);
  const filtered=useMemo(()=>items.filter(n=>category==="Toutes"||n.category===category),[items,category]);

  return <div className="public-page public-page--news public-page--news-visual">
    <PublicHeader/>
    <main className="news-page-shell">
      <section className="news-page-heading">
        <div><span className="public-kicker">{copy.kicker}</span><h1>{copy.title}</h1></div>
        <p>{copy.intro}</p>
      </section>

      <section className="news-page-content">
        {loading?<div className="loading-card">{copy.loading}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}
        {!loading&&!error?<>
          <div className="filter-row news-filter-row">
            {categories.map(c=><button key={c} className={c===category?"is-active":""} aria-pressed={c===category} onClick={()=>setCategory(c)}>{c==="Toutes"?copy.all:c}</button>)}
          </div>
          <div className="news-visual-grid">
            {filtered.map((item,index)=><article className={`news-visual-card ${index===0?"news-visual-card--featured":""}`} key={item.slug}>
              <button className="news-visual-card__image" onClick={()=>navigate(`/news/${item.slug}`)} aria-label={`${copy.read} ${item.title}`}>
                {dataProfile.reduced?<span className="media-light-placeholder" aria-label={`Illustration différée : ${item.title}`}>Image différée</span>:<img src={item.image} alt={`Illustration : ${item.title}`} loading={index===0?"eager":"lazy"} decoding="async" fetchPriority={index===0?"high":"low"} width="960" height="540" />}
                <span>{item.kind || item.category}</span>
              </button>
              <div className="news-visual-card__content">
                <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
                <h2>{item.title}</h2><p>{item.excerpt}</p>
                <button className="news-read-link" onClick={()=>navigate(`/news/${item.slug}`)}>{copy.read} <span>→</span></button>
              </div>
            </article>)}
          </div>
        </>:null}
      </section>
    </main>
    <Footer/>
  </div>;
}
