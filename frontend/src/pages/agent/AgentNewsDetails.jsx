import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNewsItem } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentNewsDetails({params}) {
  const [item,setItem]=useState(undefined);

  useEffect(()=>{
    let active=true;
    getNewsItem(params.slug).then(data=>active&&setItem(data)).catch(()=>active&&setItem(null));
    return()=>{active=false};
  },[params.slug]);

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Communication municipale" title={item?.title || "Publication"}/>
      <main className="portal-content portal-detail-page">
        <button className="back-link" onClick={()=>navigate("/agent/news")}>← Retour aux publications</button>
        {!item ? <section className="portal-card portal-empty-centered"><h2>{item===undefined?"Chargement…":"Publication introuvable"}</h2></section> :
        <article className="portal-news-detail">
          <div className="portal-news-detail__media"><img src={item.image} alt="" /></div>
          <div className="portal-news-detail__content">
            <div className="news-meta"><span>{item.kind||item.category}</span><time>{item.date}</time></div>
            <h2>{item.title}</h2>
            <p className="portal-news-detail__lead">{item.excerpt}</p>
            <div className="portal-news-detail__body">{item.body}</div>
          </div>
        </article>}
      </main>
    </div>
  </div>;
}
