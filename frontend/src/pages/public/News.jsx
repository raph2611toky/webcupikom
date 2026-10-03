import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNews } from "../../api/news.js";
import { getLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function News(){
  const locale=getLocale();
  const [items,setItems]=useState([]);
  const [category,setCategory]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    getNews()
      .then(data=>mounted&&setItems(data))
      .catch(()=>mounted&&setError(locale==="en"?"Unable to load news.":"Impossible de charger les actualités."))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[locale]);

  const categories=useMemo(()=>["Toutes",...Array.from(new Set(items.map(n=>n.category).filter(Boolean)))],[items]);
  const filtered=useMemo(()=>items.filter(n=>category==="Toutes"||n.category===category),[items,category]);

  return <div className="public-page public-page--news public-page--news-visual">
    <PublicHeader/>
    <main className="news-page-shell">
      <section className="news-page-heading">
        <div>
          <span className="public-kicker">{locale==="en"?"CITY NEWS":"ACTUALITÉS MUNICIPALES"}</span>
          <h1>{locale==="en"?<>Nova Terra <em>news.</em></>:<>Les informations de <em>Nova Terra.</em></>}</h1>
        </div>
        <p>{locale==="en"?"Announcements, service changes and useful information published by the city.":"Annonces, changements de service et informations pratiques publiés par la ville."}</p>
      </section>

      <section className="news-page-content">
        {loading?<div className="loading-card">{locale==="en"?"Loading news…":"Chargement des actualités…"}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}
        {!loading&&!error?<>
          <div className="filter-row news-filter-row">
            {categories.map(c=><button key={c} className={c===category?"is-active":""} aria-pressed={c===category} onClick={()=>setCategory(c)}>{locale==="en"&&c==="Toutes"?"All":c}</button>)}
          </div>

          <div className="news-visual-grid">
            {filtered.map((item,index)=>
              <article className={`news-visual-card ${index===0?"news-visual-card--featured":""}`} key={item.slug}>
                <button className="news-visual-card__image" onClick={()=>navigate(`/news/${item.slug}`)} aria-label={`${locale==="en"?"Read":"Lire"} ${item.title}`}>
                  <img src={item.image} alt={`${locale==="en"?"Illustration":"Illustration"} : ${item.title}`} />
                  <span>{item.kind || item.category}</span>
                </button>
                <div className="news-visual-card__content">
                  <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
                  <h2>{item.title}</h2>
                  <p>{item.excerpt}</p>
                  <button className="news-read-link" onClick={()=>navigate(`/news/${item.slug}`)}>{locale==="en"?"Read article":"Lire l’actualité"} <span>→</span></button>
                </div>
              </article>
            )}
          </div>
        </>:null}
      </section>
    </main>
    <Footer/>
  </div>;
}
