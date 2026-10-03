import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
import { useDataMode } from "../../utils/useDataMode.js";

export default function AgentNews(){
  const dataProfile=useDataMode();
  const [items,setItems]=useState([]);
  useEffect(()=>{getNews().then(setItems).catch(()=>setItems([]))},[]);
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Communication municipale" title="Publications"/>
    <main className="portal-content"><section className="portal-card management-list">
      {items.map(item=><article key={item.slug} className="management-row">
        <div className="management-row__main management-row__main--news"><div className="management-news-thumb">{dataProfile.reduced?<span className="media-light-placeholder" aria-label="Image différée en mode léger">Image différée</span>:<img src={item.image} alt="" loading="lazy" decoding="async" width="320" height="180" fetchPriority="low"/>}</div><div><span>{item.category}</span><h3>{item.title}</h3><p>{item.excerpt}</p></div></div>
        <div className="management-row__actions"><button className="secondary-action" onClick={()=>navigate(`/agent/news/${item.slug}`)}>Consulter →</button></div>
      </article>)}
    </section></main>
  </div></div>;
}
