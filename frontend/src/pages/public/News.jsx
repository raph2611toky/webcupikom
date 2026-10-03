import { useEffect, useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

export default function News(){
  const [items,setItems]=useState([]);
  const [category,setCategory]=useState("Toutes");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{let mounted=true;getNews().then(data=>mounted&&setItems(data)).catch(()=>mounted&&setError("Impossible de charger les actualités.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const categories=useMemo(()=>["Toutes",...Array.from(new Set(items.map(n=>n.category).filter(Boolean)))],[items]);
  const filtered=useMemo(()=>items.filter(n=>category==="Toutes"||n.category===category),[items,category]);

  return <div className="public-page"><PublicHeader/><main>
    <section className="public-hero public-hero--compact"><span className="public-kicker">Journal de la ville</span><h1>Actualités<br/><em>Terra Nova</em></h1><p>Travaux, services, alertes et informations utiles : suivez ce qui change dans la ville.</p></section>
    <section className="public-content">{loading?<div className="loading-card">Chargement des actualités…</div>:null}{error?<div className="error-card">{error}</div>:null}{!loading&&!error?<><div className="filter-row">{categories.map(c=><button key={c} className={c===category?"is-active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <div className="news-list">{filtered.map((item,index)=><article className="news-card" key={item.slug}><div className="news-card__index">{String(index+1).padStart(2,'0')}</div><div><div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div><h2>{item.title}</h2><p>{item.excerpt}</p></div><button onClick={()=>navigate(`/news/${item.slug}`)}>Lire <span>↗</span></button></article>)}</div></>:null}
    </section></main><Footer/></div>;
}
