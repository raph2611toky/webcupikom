import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNewsItem } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenNewsDetails({params}){
  const [item,setItem]=useState(undefined);

  useEffect(()=>{getNewsItem(params.slug).then(setItem)},[params.slug]);

  if(item===undefined) return null;

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Actualités" title={item ? "Publication municipale" : "Actualité introuvable"}/>
      <main className="portal-content citizen-news-detail-page">
        {!item ? <section className="portal-card citizen-news-missing">
          <h2>Cette publication n’est pas disponible.</h2>
          <button className="primary-action" onClick={()=>navigate("/citizen/news")}>Retour aux actualités</button>
        </section> :
        <>
          <button className="back-link" onClick={()=>navigate("/citizen/news")}>← Toutes les actualités</button>
          <article className="citizen-news-detail">
            <div className="citizen-news-detail__image"><img src={item.image} alt={`Illustration : ${item.title}`} /></div>
            <div className="citizen-news-detail__content">
              <div className="news-meta"><span>{item.kind||item.category}</span><time>{item.date}</time></div>
              <h2>{item.title}</h2>
              <p className="citizen-news-detail__lead">{item.excerpt}</p>
              <p className="citizen-news-detail__body">{item.body}</p>
              <div className="citizen-news-detail__official">Publication officielle de Nova Terra.</div>
            </div>
          </article>
        </>}
      </main>
    </div>
  </div>;
}
