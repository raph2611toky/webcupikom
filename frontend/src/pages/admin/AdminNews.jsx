import { useEffect, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNews } from "../../api/news.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
export default function AdminNews(){
  const [news,setNews]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getNews().then(data=>mounted&&setNews(data)).catch(()=>mounted&&setError("Impossible de charger les actualités.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Communication" title="Actualités"/><main className="portal-content">{loading?<div className="loading-card">Chargement…</div>:null}{error?<div className="error-card">{error}</div>:null}{!loading&&!error?<section className="portal-card"><p className="detail-copy">Lecture depuis l’API actuelle. L’édition sera activée dès qu’un endpoint administratif d’écriture sera disponible.</p><div className="admin-news-list">{news.map(n=><article key={n.slug}><div><span>{n.category}</span><h3>{n.title}</h3><p>{n.excerpt}</p></div><div><time>{n.date}</time><em>Publié</em></div></article>)}</div></section>:null}</main></div></div>;
}
