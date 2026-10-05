import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getNews } from "../../api/news.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { useDataMode } from "../../utils/useDataMode.js";
import useRealtimeRefresh from "../../realtime/useRealtimeRefresh.js";
import "../../styles/pages/citizen-news-v120.css";

const COPY={
  fr:{eyebrow:"Informations municipales",title:"Actualités",kicker:"Nova Terra aujourd’hui",headline:<>Les informations utiles,<br/>au même endroit.</>,intro:"Annonces municipales, changements de service et informations pratiques publiés pour les habitants.",all:"Toutes",news:"Actualités",announcement:"Annonces",alert:"Alertes",read:"Lire",loading:"Chargement…",error:"Impossible de charger les actualités.",search:"Rechercher une publication…",category:"Toutes les catégories",empty:"Aucune publication pour ce filtre.",emptyHint:"Modifiez le type, la catégorie ou la recherche.",result:"publication",results:"publications"},
  en:{eyebrow:"City information",title:"News",kicker:"Nova Terra today",headline:<>Useful information,<br/>in one place.</>,intro:"City announcements, service changes and practical information for residents.",all:"All",news:"News",announcement:"Announcements",alert:"Alerts",read:"Read",loading:"Loading…",error:"Unable to load news.",search:"Search publications…",category:"All categories",empty:"No publication matches these filters.",emptyHint:"Change the type, category or search.",result:"publication",results:"publications"},
  mg:{eyebrow:"Vaovaon'ny tanàna",title:"Vaovao",kicker:"Nova Terra androany",headline:<>Vaovao ilaina,<br/>amin'ny toerana iray.</>,intro:"Filazana avy amin'ny tanàna, fiovan'ny sampan-draharaha ary vaovao ilaina ho an'ny mponina.",all:"Rehetra",news:"Vaovao",announcement:"Filazana",alert:"Fampitandremana",read:"Hamaky",loading:"Mampiditra…",error:"Tsy afaka mampiseho ny vaovao.",search:"Hitady publication…",category:"Sokajy rehetra",empty:"Tsy misy publication mifanaraka.",emptyHint:"Ovay ny karazana, sokajy na fikarohana.",result:"publication",results:"publications"}
};

function typeLabel(type,copy){
  if(type==="alert")return copy.alert;
  if(type==="announcement")return copy.announcement;
  return copy.news;
}

export default function CitizenNews(){
  const dataProfile=useDataMode();
  const [locale]=useLocale();
  const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]);
  const initialType=new URLSearchParams(window.location.search).get("type")||"all";
  const [typeFilter,setTypeFilter]=useState(["news","announcement","alert"].includes(initialType)?initialType:"all");
  const [category,setCategory]=useState("all");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const perPage=6;

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    getNews().then(data=>active&&setItems(data)).catch(()=>active&&setError(copy.error)).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[locale]);

  useRealtimeRefresh("terra-news-updated", ()=>{
    getNews({force:true}).then(setItems).catch(()=>{});
  });

  useEffect(()=>{
    const syncType=()=>{
      const value=new URLSearchParams(window.location.search).get("type")||"all";
      setTypeFilter(["news","announcement","alert"].includes(value)?value:"all");
      setCategory("all");
      setPage(1);
    };
    window.addEventListener("popstate",syncType);
    return()=>window.removeEventListener("popstate",syncType);
  },[]);

  const typeOptions=[["all",copy.all],["news",copy.news],["announcement",copy.announcement],["alert",copy.alert]];
  const typeVisible=useMemo(()=>items.filter(item=>typeFilter==="all"||(item.publication_type||item.publicationType)===typeFilter),[items,typeFilter]);
  const categories=useMemo(()=>Array.from(new Set(typeVisible.map(item=>item.category).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b),locale)),[typeVisible,locale]);
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return typeVisible
      .filter(item=>category==="all"||item.category===category)
      .filter(item=>!q||`${item.title||""} ${item.excerpt||""} ${item.category||""}`.toLowerCase().includes(q))
      .sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||Number(Boolean(b.important))-Number(Boolean(a.important))||String(b.publishedAt||b.date||"").localeCompare(String(a.publishedAt||a.date||"")));
  },[typeVisible,category,query]);

  useEffect(()=>{setPage(1)},[typeFilter,category,query]);
  const totalPages=Math.max(1,Math.ceil(visible.length/perPage));
  const pageItems=visible.slice((page-1)*perPage,page*perPage);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);

  function chooseType(value){
    setTypeFilter(value);
    setCategory("all");
    const url=value==="all"?"/citizen/news":`/citizen/news?type=${encodeURIComponent(value)}`;
    window.history.replaceState({},"",url);
  }

  return <div className="portal-layout">
    <CitizenSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
      <main className="portal-content citizen-news-page citizen-news-page-v94">
        {loading?<div className="loading-card">{copy.loading}</div>:null}
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <section className="citizen-news-intro">
          <div><span className="section-label">{copy.kicker}</span><h2>{copy.headline}</h2></div>
          <p>{copy.intro}</p>
        </section>

        <section className="portal-card citizen-news-controls" aria-label="Filtres des publications">
          <div className="citizen-news-type-filters" role="group" aria-label="Type de publication">
            {typeOptions.map(([value,label])=><button type="button" key={value} className={typeFilter===value?"is-active":""} aria-pressed={typeFilter===value} onClick={()=>chooseType(value)}>{label}</button>)}
          </div>
          <div className="citizen-news-control-line">
            <label className="citizen-news-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search}/></label>
            {categories.length>1?<label className="citizen-news-category"><span className="sr-only">{copy.category}</span><select value={category} onChange={event=>setCategory(event.target.value)}><option value="all">{copy.category}</option>{categories.map(item=><option key={item} value={item}>{item}</option>)}</select></label>:null}
            <span className="citizen-news-result-count">{visible.length} {visible.length===1?copy.result:copy.results}</span>
          </div>
        </section>

        {!loading&&!pageItems.length?<div className="portal-card citizen-news-empty" role="status"><strong>{typeFilter==="alert"?"Aucune alerte municipale active.":copy.empty}</strong><span>{copy.emptyHint}</span></div>:null}

        {pageItems.length?<section className="citizen-news-grid citizen-news-grid-v94" aria-label="Publications municipales">
          {pageItems.map((item,index)=>{
            const type=item.publication_type||item.publicationType||"news";
            return <article className={`citizen-news-card${item.important?" is-important":""}${item.pinned?" is-pinned":""}`} key={item.slug}>
              <button className="citizen-news-card__image" onClick={()=>navigate(`/citizen/news/${item.slug}`)} aria-label={`${copy.read} ${item.title}`}>
                {dataProfile.reduced?<span className="media-light-placeholder" aria-label={`Illustration différée : ${item.title}`}>Image différée</span>:<img src={item.image} alt={item.coverAlt||`Illustration : ${item.title}`} loading={index<2?"eager":"lazy"} decoding="async" fetchPriority={index===0?"high":"low"} width="960" height="540"/>}
                <span className={`citizen-news-type type-${type}`}>{typeLabel(type,copy)}</span>
                {item.important?<em className="citizen-news-important">Important</em>:null}
              </button>
              <div className="citizen-news-card__content">
                <div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div>
                <h3>{item.title}</h3><p>{item.excerpt}</p>
                {(item.instructions||item.audienceGuidanceList?.length)?
                  <span className="citizen-news-card__guidance">! Consignes disponibles</span>
                :null}
                <button className="news-read-link" onClick={()=>navigate(`/citizen/news/${item.slug}`)}>{copy.read} →</button>
              </div>
            </article>;
          })}
        </section>:null}

        {!loading&&visible.length?<PortalPagination page={page} totalPages={totalPages} totalItems={visible.length} perPage={perPage} onPageChange={setPage} itemLabel={copy.result} itemLabelPlural={copy.results}/>:null}
      </main>
    </div>
  </div>;
}
