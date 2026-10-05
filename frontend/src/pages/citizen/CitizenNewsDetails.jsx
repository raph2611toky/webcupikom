import { useEffect, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getNewsItem } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { useDataMode } from "../../utils/useDataMode.js";
import "../../styles/pages/citizen-news-v120.css";

const COPY={
  fr:{
    eyebrow:"Actualités",
    title:"Publication municipale",
    missing:"Actualité introuvable",
    missingText:"Cette publication n’est pas disponible.",
    back:"Toutes les actualités",
    official:"Publication officielle de Nova Terra.",
    recommendation:"Recommandations à suivre",
    recommendationHelp:"Consignes publiées par la ville pour cette situation.",
    audiences:"Consignes selon le public concerné",
    areas:"Zones concernées",
    source:"Source",
    important:"Important",
    practical:"Informations utiles",
    readSource:"Consulter la source",
    action:"Action recommandée",
    noRecommendation:"Aucune consigne spécifique n’a encore été publiée. Consultez régulièrement cette alerte pour voir les nouvelles recommandations de la ville.",
  },
  en:{
    eyebrow:"News",
    title:"City publication",
    missing:"News item not found",
    missingText:"This publication is not available.",
    back:"All news",
    official:"Official Nova Terra publication.",
    recommendation:"Recommendations to follow",
    recommendationHelp:"Instructions published by the city for this situation.",
    audiences:"Guidance by affected audience",
    areas:"Affected areas",
    source:"Source",
    important:"Important",
    practical:"Useful information",
    readSource:"View source",
    action:"Recommended action",
    noRecommendation:"No specific instruction has been published yet. Check this alert regularly for new city recommendations.",
  },
  mg:{
    eyebrow:"Vaovao",
    title:"Vaovaon'ny tanàna",
    missing:"Tsy hita ny vaovao",
    missingText:"Tsy misy ity vaovao ity.",
    back:"Vaovao rehetra",
    official:"Vaovao ofisialy avy amin'i Nova Terra.",
    recommendation:"Toromarika tokony harahina",
    recommendationHelp:"Toromarika navoakan'ny tanàna momba ity toe-javatra ity.",
    audiences:"Toromarika araka ny olona voakasika",
    areas:"Faritra voakasika",
    source:"Loharano",
    important:"Zava-dehibe",
    practical:"Fampahalalana ilaina",
    readSource:"Jereo ny loharano",
    action:"Hetsika atolotra",
    noRecommendation:"Tsy mbola misy toromarika manokana navoaka. Hamarino matetika ity fampitandremana ity raha misy toromarika vaovao.",
  }
};

function text(value){
  return String(value || "").trim();
}

export default function CitizenNewsDetails({params}){
  const dataProfile=useDataMode();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [item,setItem]=useState(undefined);

  useEffect(()=>{
    getNewsItem(params.slug).then(setItem).catch(()=>setItem(null));
  },[params.slug]);

  if(item===undefined)return null;

  if(!item){
    return <div className="portal-layout">
      <CitizenSidebar/>
      <div className="portal-main">
        <PortalTopbar eyebrow={copy.eyebrow} title={copy.missing}/>
        <main className="portal-content citizen-news-detail-page">
          <section className="portal-card citizen-news-missing">
            <h2>{copy.missingText}</h2>
            <button className="primary-action" onClick={()=>navigate("/citizen/news")}>{copy.back}</button>
          </section>
        </main>
      </div>
    </div>;
  }

  const guidance=(item.audienceGuidanceList||[]).filter((entry)=>text(entry?.audience));
  const instructions=text(item.instructions);
  const affectedAreas=text(item.affectedAreas);
  const sourceName=text(item.sourceName);
  const sourceUrl=text(item.sourceUrl);
  const actionLabel=text(item.actionLabel);
  const actionUrl=text(item.actionUrl);
  const publicationTone=item.publicationType==="alert"?"alert":item.publicationType==="announcement"?"announcement":"news";
  const hasRecommendations=Boolean(instructions||guidance.length||publicationTone==="alert");

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
      <main className="portal-content citizen-news-detail-page">
        <button className="back-link citizen-news-detail__back" onClick={()=>navigate("/citizen/news")}>← {copy.back}</button>

        <article className={`citizen-news-detail tone-${publicationTone}`}>
          <div className="citizen-news-detail__image">
            {dataProfile.reduced
              ? <span className="media-light-placeholder" aria-label={`Illustration différée : ${item.title}`}>Image différée</span>
              : <img src={item.image} alt={item.coverAlt || `Illustration : ${item.title}`} decoding="async" width="960" height="540" />
            }
            <div className="citizen-news-detail__image-badges">
              <span className="citizen-news-detail__type">{item.kind||item.category}</span>
              {item.important?<span className="citizen-news-detail__important">{copy.important}</span>:null}
            </div>
          </div>

          <div className="citizen-news-detail__content">
            <div className="citizen-news-detail__meta">
              <span>{item.category||item.kind}</span>
              <time>{item.date}</time>
            </div>

            <h2>{item.title}</h2>
            {item.excerpt?<p className="citizen-news-detail__lead">{item.excerpt}</p>:null}

            {affectedAreas?
              <div className="citizen-news-detail__affected">
                <span aria-hidden="true">⌖</span>
                <div><small>{copy.areas}</small><b>{affectedAreas}</b></div>
              </div>
            :null}

            {item.body?<div className="citizen-news-detail__body">{item.body}</div>:null}

            {hasRecommendations?
              <section className={`citizen-news-inline-recommendation tone-${publicationTone}`} aria-label={copy.recommendation}>
                <div className="citizen-news-inline-recommendation__head">
                  <span aria-hidden="true">!</span>
                  <div>
                    <small>{copy.recommendation}</small>
                    <strong>{instructions || copy.noRecommendation}</strong>
                  </div>
                </div>

                {guidance.length?
                  <div className="citizen-news-inline-recommendation__audiences">
                    {guidance.slice(0,3).map((entry,index)=>(
                      <article key={`${entry.audience}-${index}`}>
                        <i>{String(index+1).padStart(2,"0")}</i>
                        <div>
                          <b>{entry.audience}</b>
                          {text(entry.instructions||instructions)?<p>{entry.instructions||instructions}</p>:null}
                        </div>
                      </article>
                    ))}
                  </div>
                :null}
              </section>
            :null}
          </div>
        </article>

        <section className="citizen-news-detail__lower">
          {guidance.length>3?
            <article className={`portal-card citizen-news-recommendations tone-${publicationTone}`}>
              <header className="citizen-news-recommendations__head">
                <div className="citizen-news-recommendations__icon" aria-hidden="true">!</div>
                <div>
                  <span className="section-label">{copy.audiences}</span>
                  <h3>{copy.audiences}</h3>
                  <p>{copy.recommendationHelp}</p>
                </div>
              </header>
              <div className="citizen-news-guidance">
                <div className="citizen-news-guidance__list">
                  {guidance.slice(3).map((entry,index)=>(
                    <article key={`${entry.audience}-${index+3}`}>
                      <i>{String(index+4).padStart(2,"0")}</i>
                      <div>
                        <b>{entry.audience}</b>
                        {text(entry.instructions||instructions)?<p>{entry.instructions||instructions}</p>:null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </article>
          :null}

          <aside className="portal-card citizen-news-detail__practical">
            <span className="section-label">{copy.practical}</span>
            <h3>{item.kind||item.category}</h3>

            <div className="citizen-news-detail__practical-list">
              <div><span>Date</span><b>{item.date||"—"}</b></div>
              <div><span>Catégorie</span><b>{item.category||"—"}</b></div>
              {item.audience?<div><span>Public</span><b>{item.audience}</b></div>:null}
              {sourceName?<div><span>{copy.source}</span><b>{sourceName}</b></div>:null}
            </div>

            <div className="citizen-news-detail__official">{copy.official}</div>

            {sourceUrl?
              <a className="secondary-action citizen-news-detail__external" href={sourceUrl} target="_blank" rel="noreferrer">
                {copy.readSource} ↗
              </a>
            :null}

            {actionUrl?
              <a className="primary-action citizen-news-detail__external" href={actionUrl} target="_blank" rel="noreferrer">
                {actionLabel||copy.action} →
              </a>
            :null}
          </aside>
        </section>
      </main>
    </div>
  </div>;
}
