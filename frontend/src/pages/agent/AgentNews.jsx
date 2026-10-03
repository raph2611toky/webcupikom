import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentNews(){
  const [items,setItems]=useState([]);
  useEffect(()=>{getNews().then(setItems).catch(()=>setItems([]))},[]);
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Information municipale" title="Publications"/>
    <main className="portal-content"><section className="portal-card management-list">
      {items.map(item=><article key={item.slug} className="management-row">
        <div className="management-row__main management-row__main--news"><div className="management-news-thumb"><img src={item.image} alt=""/></div><div><span>{item.category}</span><h3>{item.title}</h3><p>{item.excerpt}</p></div></div>
      </article>)}
      <div className="dashboard-empty">La publication et la modification sont réservées à l’administration dans l’API actuelle.</div>
    </section></main>
  </div></div>;
}
