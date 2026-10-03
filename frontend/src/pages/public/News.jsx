import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function News(){
  const [items,setItems]=useState([]);
  const [category,setCategory]=useState("Toutes");

  useEffect(()=>{getNews().then(setItems)},[]);

  const categories=useMemo(
    ()=>["Toutes",...Array.from(new Set(items.map(n=>n.category)))],
    [items]
  );

  const filtered=useMemo(
    ()=>items.filter(n=>category==="Toutes"||n.category===category),
    [items,category]
  );

  return <div className="public-page public-page--news public-page--news-visual">
    <PublicHeader/>
    <main className="news-page-shell">
      <section className="news-page-heading">
        <div>
          <span className="public-kicker">Actualités municipales</span>
          <h1>Les informations de <em>Nova Terra.</em></h1>
        </div>
        <p>Annonces, changements de service et informations pratiques publiés par la ville.</p>
      </section>

      <section className="news-page-content">
        <div className="filter-row news-filter-row">
          {categories.map(c=><button key={c} className={c===category?"is-active":""} onClick={()=>setCategory(c)}>{c}</button>)}
        </div>

        <div className="news-visual-grid">
          {filtered.map((item,index)=>
            <article className={`news-visual-card ${index===0?"news-visual-card--featured":""}`} key={item.slug}>
              <button className="news-visual-card__image" onClick={()=>navigate(`/news/${item.slug}`)} aria-label={`Lire ${item.title}`}>
                <img src={item.image} alt={`Illustration : ${item.title}`} />
                <span>{item.kind || item.category}</span>
              </button>
              <div className="news-visual-card__content">
                <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
                <h2>{item.title}</h2>
                <p>{item.excerpt}</p>
                <button className="news-read-link" onClick={()=>navigate(`/news/${item.slug}`)}>Lire l’actualité <span>→</span></button>
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
    <Footer/>
  </div>;
}
