import { useEffect, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { getNewsItem } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const COPY={
  fr:{back:"Toutes les actualités",missing:"Actualité introuvable",official:"Publication officielle de Nova Terra."},
  en:{back:"All news",missing:"News item not found",official:"Official Nova Terra publication."},
  mg:{back:"Vaovao rehetra",missing:"Tsy hita ny vaovao",official:"Vaovao ofisialy avy amin'i Nova Terra."}
};

export default function NewsDetails({params}){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [item,setItem]=useState(undefined);
  useEffect(()=>{getNewsItem(params.slug).then(setItem).catch(()=>setItem(null))},[params.slug]);

  if(item===undefined)return null;
  if(!item)return <div className="public-page public-page--news-detail"><PublicHeader/><main className="public-content"><div className="empty-state"><h1>{copy.missing}</h1><button className="primary-button" onClick={()=>navigate("/news")}>{copy.back}</button></div></main><Footer/></div>;

  return <div className="public-page public-page--news-detail public-page--news-detail-visual">
    <PublicHeader/>
    <main className="article-visual-shell">
      <button className="text-link article-visual-back" onClick={()=>navigate("/news")}>← {copy.back}</button>
      <article className="article-visual">
        <div className="article-visual__image"><img src={item.image} alt={`Illustration : ${item.title}`} /></div>
        <div className="article-visual__content">
          <div className="news-meta"><span>{item.kind||item.category}</span><time>{item.date}</time></div>
          <h1>{item.title}</h1><p className="article-lead">{item.excerpt}</p>
          <div className="article-body"><p>{item.body}</p></div>
          <div className="article-official">{copy.official}</div>
        </div>
      </article>
    </main>
    <Footer/>
  </div>;
}
