import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getCitizenPartners } from "../../api/partners.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import "../../styles/pages/partners-usage-v97.css";

const COPY = {
  fr: { eyebrow:"Services partenaires", title:"Partenaires de la ville", intro:"Identifiez rapidement les services proposés par des partenaires extérieurs, leur disponibilité et la prochaine action possible.", search:"Rechercher un partenaire ou un service", all:"Tous", available:"Disponibles", unavailable:"Indisponibles", allCategories:"Toutes les catégories", allDistricts:"Tous les quartiers", next:"Prochaine action", hours:"Horaires", address:"Adresse", website:"Ouvrir le site", call:"Appeler", email:"Écrire", empty:"Aucun service partenaire ne correspond à ces critères.", loading:"Chargement des partenaires…" },
  en: { eyebrow:"Partner services", title:"City partners", intro:"Quickly identify services offered by external partners, their availability and the next possible action.", search:"Search a partner or service", all:"All", available:"Available", unavailable:"Unavailable", allCategories:"All categories", allDistricts:"All districts", next:"Next action", hours:"Hours", address:"Address", website:"Open website", call:"Call", email:"Email", empty:"No partner service matches these filters.", loading:"Loading partners…" },
  mg: { eyebrow:"Serivisy mpiara-miombon'antoka", title:"Mpiara-miombon'antoka amin'ny tanàna", intro:"Jereo haingana ny serivisy omen'ny mpiara-miombon'antoka, ny fahafahany ary ny dingana manaraka.", search:"Hitady mpiara-miombon'antoka", all:"Rehetra", available:"Misy", unavailable:"Tsy misy", allCategories:"Sokajy rehetra", allDistricts:"Faritra rehetra", next:"Dingana manaraka", hours:"Ora", address:"Adiresy", website:"Hijery tranonkala", call:"Antsoy", email:"Mailaka", empty:"Tsy misy serivisy mifanaraka amin'ny sivana.", loading:"Mamaky mpiara-miombon'antoka…" },
};

function cleanUrl(value="") {
  const raw=String(value||"").trim();
  if(!raw)return "";
  return /^https?:\/\//i.test(raw)?raw:`https://${raw}`;
}

export default function CitizenPartners(){
  const [locale]=useLocale(); const copy=COPY[locale]||COPY.fr;
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [query,setQuery]=useState(""); const [status,setStatus]=useState("all"); const [category,setCategory]=useState(""); const [district,setDistrict]=useState(""); const [page,setPage]=useState(1);
  const perPage=6;

  useEffect(()=>{let active=true;getCitizenPartners().then(rows=>active&&setItems(rows)).catch(e=>active&&setError(getApiErrorMessage(e,"Impossible de charger les services partenaires."))).finally(()=>active&&setLoading(false));return()=>{active=false}},[]);
  const categories=useMemo(()=>[...new Set(items.map(i=>i.category).filter(Boolean))].sort(),[items]);
  const districts=useMemo(()=>[...new Set(items.map(i=>i.district).filter(Boolean))].sort(),[items]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return items.filter(item=>{
    const matchesStatus=status==="all"||(status==="available"?item.isAvailable:item.isAvailable===false);
    const matchesCategory=!category||item.category===category; const matchesDistrict=!district||item.district===district;
    const hay=`${item.name} ${item.partnerName} ${item.category} ${item.description} ${item.district}`.toLowerCase();
    return matchesStatus&&matchesCategory&&matchesDistrict&&(!q||hay.includes(q));
  })},[items,query,status,category,district]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));
  useEffect(()=>setPage(1),[query,status,category,district]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  const rows=filtered.slice((page-1)*perPage,page*perPage);
  const availableCount=items.filter(i=>i.isAvailable).length;

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow={copy.eyebrow} title={copy.title}/>
    <main className="portal-content partner-page">
      <section className="partner-intro portal-card"><div><span className="section-label">F99 · Offre extérieure</span><h2>{copy.title}</h2><p>{copy.intro}</p></div><div className="partner-intro__stats"><div><strong>{items.length}</strong><span>services partenaires</span></div><div><strong>{availableCount}</strong><span>{copy.available.toLowerCase()}</span></div><div><strong>{items.length-availableCount}</strong><span>{copy.unavailable.toLowerCase()}</span></div></div></section>
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="partner-toolbar" aria-label="Filtres des partenaires">
        <label className="portal-search partner-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={copy.search}/></label>
        <select value={category} onChange={e=>setCategory(e.target.value)} aria-label={copy.allCategories}><option value="">{copy.allCategories}</option>{categories.map(v=><option key={v}>{v}</option>)}</select>
        <select value={district} onChange={e=>setDistrict(e.target.value)} aria-label={copy.allDistricts}><option value="">{copy.allDistricts}</option>{districts.map(v=><option key={v}>{v}</option>)}</select>
        <div className="partner-status-tabs" role="group" aria-label="Disponibilité"><button type="button" className={status==="all"?"is-active":""} onClick={()=>setStatus("all")}>{copy.all}</button><button type="button" className={status==="available"?"is-active":""} onClick={()=>setStatus("available")}>{copy.available}</button><button type="button" className={status==="unavailable"?"is-active":""} onClick={()=>setStatus("unavailable")}>{copy.unavailable}</button></div>
      </section>
      {loading?<div className="loading-card" role="status">{copy.loading}</div>:rows.length?<section className="partner-grid">{rows.map(item=><article className={`partner-card ${item.isAvailable?"is-available":"is-unavailable"}`} key={item.slug}>
        <div className="partner-card__head"><div><span className="partner-card__category">{item.category}</span><h3>{item.name}</h3><p className="partner-card__owner">{item.partnerName}</p></div><span className="partner-availability" aria-label={`${item.availabilityLabel}`}>{item.isAvailable?"●":"○"} {item.availabilityLabel}</span></div>
        <p className="partner-card__description">{item.description||"Service proposé par un partenaire extérieur de Nova Terra."}</p>
        <dl className="partner-card__facts">{item.openingHours?<div><dt>{copy.hours}</dt><dd>{item.openingHours}</dd></div>:null}{item.address?<div><dt>{copy.address}</dt><dd>{item.address}{item.district?` · ${item.district}`:""}</dd></div>:null}</dl>
        <div className="partner-next-action"><span>{copy.next}</span><strong>{item.nextAction}</strong></div>
        <div className="partner-card__actions">{item.website?<a href={cleanUrl(item.website)} target="_blank" rel="noreferrer">{copy.website} ↗</a>:null}{item.phone?<a href={`tel:${item.phone}`}>{copy.call}</a>:null}{item.email?<a href={`mailto:${item.email}`}>{copy.email}</a>:null}</div>
      </article>)}</section>:<div className="portal-card partner-empty">{copy.empty}</div>}
      {!loading&&filtered.length?<PortalPagination page={page} totalPages={totalPages} totalItems={filtered.length} perPage={perPage} onPageChange={setPage} itemLabel="service partenaire" itemLabelPlural="services partenaires"/>:null}
    </main>
  </div></div>;
}
