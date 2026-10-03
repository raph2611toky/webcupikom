import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenNews(){
  const [items,setItems]=useState([]);
  const [filter,setFilter]=useState("Toutes");

  useEffect(()=>{
    const load=()=>getNews().then(setItems);
    load();
    window.addEventListener("terra-news-updated",load);
    return ()=>window.removeEventListener("terra-news-updated",load);
  },[]);

  const filters=useMemo(
    ()=>["Toutes",...Array.from(new Set(items.map(item=>item.category)))],
    [items]
  );

  const visible=useMemo(
    ()=>items.filter(item=>filter==="Toutes"||item.category===filter),
    [items,filter]
  );

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Informations municipales" title="Actualités"/>
      <main className="portal-content citizen-news-page">
        <section className="citizen-news-intro">
          <div>
            <span className="section-label">Nova Terra aujourd’hui</span>
            <h2>Les informations utiles,<br/>au même endroit.</h2>
          </div>
          <p>Annonces municipales, changements de service et informations pratiques publiés pour les habitants.</p>
        </section>

        <div className="filter-row filter-row--portal citizen-news-filters">
          {filters.map(item=><button key={item} className={filter===item?"is-active":""} onClick={()=>setFilter(item)}>{item}</button>)}
        </div>

        <section className="citizen-news-grid">
          {visible.map((item,index)=><article className={index===0?"citizen-news-card is-featured":"citizen-news-card"} key={item.slug}>
            <button className="citizen-news-card__image" onClick={()=>navigate(`/citizen/news/${item.slug}`)}>
              <img src={item.image} alt={`Illustration : ${item.title}`} />
              <span>{item.kind || item.category}</span>
            </button>
            <div>
              <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
              <button className="news-read-link" onClick={()=>navigate(`/citizen/news/${item.slug}`)}>Lire →</button>
            </div>
          </article>)}
        </section>
      </main>
    </div>
  </div>;
}
