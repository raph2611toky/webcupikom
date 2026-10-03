import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNewsItem } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
import { useDataMode } from "../../utils/useDataMode.js";

const COPY={
  fr:{eyebrow:"Actualités",title:"Publication municipale",missing:"Actualité introuvable",missingText:"Cette publication n’est pas disponible.",back:"Toutes les actualités",official:"Publication officielle de Nova Terra."},
  en:{eyebrow:"News",title:"City publication",missing:"News item not found",missingText:"This publication is not available.",back:"All news",official:"Official Nova Terra publication."},
  mg:{eyebrow:"Vaovao",title:"Vaovaon'ny tanàna",missing:"Tsy hita ny vaovao",missingText:"Tsy misy ity vaovao ity.",back:"Vaovao rehetra",official:"Vaovao ofisialy avy amin'i Nova Terra."}
};

export default function CitizenNewsDetails({params}){
  const dataProfile=useDataMode();
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [item,setItem]=useState(undefined);
  useEffect(()=>{getNewsItem(params.slug).then(setItem).catch(()=>setItem(null))},[params.slug]);

  if(item===undefined)return null;
  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={item?copy.title:copy.missing}/>
      <main className="portal-content citizen-news-detail-page">
        {!item?<section className="portal-card citizen-news-missing"><h2>{copy.missingText}</h2><button className="primary-action" onClick={()=>navigate("/citizen/news")}>{copy.back}</button></section>:
        <>
          <button className="back-link" onClick={()=>navigate("/citizen/news")}>← {copy.back}</button>
          <article className="citizen-news-detail">
            <div className="citizen-news-detail__image">{dataProfile.reduced?<span className="media-light-placeholder" aria-label={`Illustration différée : ${item.title}`}>Image différée</span>:<img src={item.image} alt={`Illustration : ${item.title}`} decoding="async" width="960" height="540" />}</div>
            <div className="citizen-news-detail__content">
              <div className="news-meta"><span>{item.kind||item.category}</span><time>{item.date}</time></div>
              <h2>{item.title}</h2><p className="citizen-news-detail__lead">{item.excerpt}</p>
              <p className="citizen-news-detail__body">{item.body}</p>
              <div className="citizen-news-detail__official">{copy.official}</div>
            </div>
          </article>
        </>}
      </main>
    </div>
  </div>;
}
