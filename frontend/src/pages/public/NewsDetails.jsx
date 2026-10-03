import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNewsItem } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function NewsDetails({params}){
  const [item,setItem]=useState(undefined);
  useEffect(()=>{getNewsItem(params.slug).then(setItem)},[params.slug]);
  if(item===undefined) return null;
  if(!item) return <div className="public-page public-page--news-detail"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>Actualité introuvable</h1><button className="primary-button" onClick={()=>navigate('/news')}>Retour</button></div></main><Footer/></div>;
  return <div className="public-page public-page--news-detail"><PublicHeader/><main>
    <article className="article-page"><button className="text-link" onClick={()=>navigate('/news')}>← Toutes les actualités</button><div className="news-meta"><span>{item.kind||item.category}</span><time>{item.date}</time></div><h1>{item.title}</h1><p className="article-lead">{item.excerpt}</p><div className="article-body"><p>{item.body}</p><blockquote>Publication officielle de Nova Terra.</blockquote></div></article>
  </main><Footer/></div>;
}
