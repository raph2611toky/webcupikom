import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getSupportableCitizenRequests, setCitizenRequestSupport } from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

function formatDate(value){
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(date);
}

export default function CitizenRequestSupport(){
  const [rows,setRows]=useState([]);
  const [query,setQuery]=useState("");
  const [district,setDistrict]=useState("");
  const [category,setCategory]=useState("");
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [next,setNext]=useState(false);
  const [previous,setPrevious]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load(targetPage=page){
    setLoading(true);setError("");
    try{
      const result=await getSupportableCitizenRequests({
        search:query||undefined,
        district:district||undefined,
        category:category||undefined,
        page:targetPage,
        page_size:12,
      });
      setRows(result.results);setTotal(result.count);setNext(Boolean(result.next));setPrevious(Boolean(result.previous));
    }catch(e){setError(getApiErrorMessage(e,"Impossible de charger les demandes citoyennes à soutenir."))}
    finally{setLoading(false)}
  }

  useEffect(()=>{const timer=window.setTimeout(()=>load(page),query?220:0);return()=>window.clearTimeout(timer)},[query,district,category,page]);

  const districts=useMemo(()=>Array.from(new Set(rows.map(item=>item.district).filter(Boolean))).sort(),[rows]);
  const categories=useMemo(()=>Array.from(new Map(rows.filter(item=>item.categoryCode||item.categoryLabel).map(item=>[item.categoryCode||item.categoryLabel,item.categoryLabel||item.categoryCode])).entries()),[rows]);

  async function toggle(item){
    if(busy)return;
    setBusy(item.reference);setError("");setNotice("");
    try{
      const state=await setCitizenRequestSupport(item.reference,!item.isSupported);
      setRows(current=>current.map(row=>row.reference===item.reference?{...row,isSupported:state.supported,canSupport:state.canSupport,supportCount:state.supportCount}:row));
      setNotice(state.confirmation||"Votre choix a été enregistré.");
    }catch(e){setError(getApiErrorMessage(e,"Impossible de mettre à jour votre soutien."))}
    finally{setBusy("")}
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Participation citoyenne" title="Soutenir une demande" subtitle="Soutenez un signalement public déjà déposé, sans exposer les informations personnelles de son auteur." actions={<button type="button" className="topbar-ghost" onClick={()=>navigate("/citizen/requests")}>← Mes demandes</button>}/>
    <main className="portal-content request-support-page">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      {notice?<div className="success-inline" role="status">✓ {notice}</div>:null}

      <section className="portal-card request-support-intro">
        <div className="request-support-intro__icon" aria-hidden="true">♡</div>
        <div><span className="section-label">SOUTIEN CITOYEN</span><h2>Faire remonter un besoin partagé</h2><p>Le backend ne publie ici que les signalements ouverts et éligibles au soutien. Le nom, l’e-mail, le message complet et les autres données personnelles du déposant ne sont jamais affichés.</p></div>
        <div className="request-support-intro__count"><strong>{total}</strong><span>demande{total>1?"s":""} soutenable{total>1?"s":""}</span></div>
      </section>

      <section className="request-support-toolbar" aria-label="Filtres des demandes à soutenir">
        <label className="portal-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Rechercher un quartier, une catégorie…" aria-label="Rechercher une demande citoyenne"/></label>
        <select value={district} onChange={e=>{setDistrict(e.target.value);setPage(1)}} aria-label="Filtrer par quartier"><option value="">Tous les quartiers</option>{districts.map(value=><option key={value} value={value}>{value}</option>)}</select>
        <select value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}} aria-label="Filtrer par catégorie"><option value="">Toutes les catégories</option>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      </section>

      {loading?<div className="loading-card" role="status">Chargement des demandes soutenables…</div>:null}
      {!loading&&!rows.length?<section className="portal-card request-support-empty"><strong>Aucune demande soutenable pour le moment</strong><span>Les signalements clos, dupliqués ou non éligibles ne sont pas publiés dans cette liste.</span></section>:null}

      {!loading&&rows.length?<section className="request-support-grid" aria-label="Demandes citoyennes soutenables">{rows.map(item=><article className={`request-support-card ${item.isSupported?"is-supported":""}`} key={item.reference}>
        <div className="request-support-card__top"><span className={`status-pill status-${item.status}`}>{item.statusLabel}</span><code>{item.reference}</code></div>
        <div className="request-support-card__body"><span className="request-support-category">{item.categoryLabel}</span><h3>{item.title}</h3><div className="request-support-meta"><span>⌖ {item.district||"Quartier non précisé"}</span>{item.serviceName?<span>Service : {item.serviceName}</span>:null}<span>Publié le {formatDate(item.createdAt)}</span></div></div>
        <div className="request-support-card__footer"><div><strong>{item.supportCount}</strong><span>soutien{item.supportCount>1?"s":""}</span></div><button type="button" className={item.isSupported?"secondary-action":"primary-action"} aria-pressed={item.isSupported} disabled={busy===item.reference||(!item.isSupported&&!item.canSupport)} onClick={()=>toggle(item)}>{busy===item.reference?"Enregistrement…":item.isSupported?"Retirer mon soutien":"Soutenir cette demande"}</button></div>
      </article>)}</section>:null}

      {total>12?<div className="request-support-pagination" aria-label="Pagination"><button type="button" className="secondary-action" disabled={!previous||loading} onClick={()=>setPage(value=>Math.max(1,value-1))}>← Précédent</button><span>Page {page}</span><button type="button" className="secondary-action" disabled={!next||loading} onClick={()=>setPage(value=>value+1)}>Suivant →</button></div>:null}
    </main>
  </div></div>;
}
