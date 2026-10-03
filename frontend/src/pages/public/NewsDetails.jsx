import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNewsItem } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function NewsDetails({params}){
  const [item,setItem]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;getNewsItem(params.slug).then(data=>mounted&&setItem(data)).catch(()=>mounted&&setError("Actualité introuvable.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[params.slug]);
  if(loading)return <div className="public-page"><PublicHeader/><main className="public-content"><div className="loading-card">Chargement…</div></main><Footer/></div>;
  if(error||!item)return <div className="public-page"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>Actualité introuvable</h1><button className="primary-button" onClick={()=>navigate('/news')}>Retour</button></div></main><Footer/></div>;
  return <div className="public-page"><PublicHeader/><main>
    <article className="article-page"><button className="text-link" onClick={()=>navigate('/news')}>← Toutes les actualités</button><div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div><h1>{item.title}</h1><p className="article-lead">{item.excerpt}</p><div className="article-body"><p>{item.body}</p><blockquote>Terra Nova évolue en continu : les informations importantes sont également relayées dans les espaces citoyens.</blockquote></div></article>
  </main><Footer/></div>;
}
