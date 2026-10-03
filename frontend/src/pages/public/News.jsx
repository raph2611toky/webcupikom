import { useMemo, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { news } from "../../data/news.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const categories=["Toutes","Important","Transport","Administration","Santé"];
export default function News(){
  const [category,setCategory]=useState("Toutes");
  const filtered=useMemo(()=>news.filter(n=>category==="Toutes"||n.category===category),[category]);
  return <div className="public-page"><PublicHeader/><main>
    <section className="public-hero public-hero--compact"><span className="public-kicker">Journal de la ville</span><h1>Actualités<br/><em>Terra Nova</em></h1><p>Travaux, services, alertes et informations utiles : suivez ce qui change dans la ville.</p></section>
    <section className="public-content"><div className="filter-row">{categories.map(c=><button key={c} className={c===category?"is-active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <div className="news-list">{filtered.map((item,index)=><article className="news-card" key={item.slug}><div className="news-card__index">{String(index+1).padStart(2,'0')}</div><div><div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div><h2>{item.title}</h2><p>{item.excerpt}</p></div><button onClick={()=>navigate(`/news/${item.slug}`)}>Lire <span>↗</span></button></article>)}</div>
    </section></main><Footer/></div>;
}
