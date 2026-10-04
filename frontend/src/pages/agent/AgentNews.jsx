import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getNews } from "../../api/news.js";
import { navigate } from "../../utils/navigation.js";
import { useDataMode } from "../../utils/useDataMode.js";
import useRealtimeRefresh from "../../realtime/useRealtimeRefresh.js";

export default function AgentNews(){
  const dataProfile=useDataMode();
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const perPage=8;
  useEffect(()=>{let active=true;setLoading(true);getNews().then(rows=>active&&setItems(rows)).catch(()=>active&&setItems([])).finally(()=>active&&setLoading(false));return()=>{active=false}},[]);
  useRealtimeRefresh("terra-news-updated", ()=>{getNews({force:true}).then(setItems).catch(()=>{});});
  const rows=useMemo(()=>{const q=query.trim().toLowerCase();return items.filter(item=>!q||`${item.title||""} ${item.category||""} ${item.excerpt||""}`.toLowerCase().includes(q))},[items,query]);
  const totalPages=Math.max(1,Math.ceil(rows.length/perPage));
  const pageRows=rows.slice((page-1)*perPage,page*perPage);
  useEffect(()=>{setPage(1)},[query]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Communication municipale" title="Publications"/>
    <main className="portal-content">
      <section className="toolbar-card"><label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une publication…" aria-label="Rechercher une publication"/></label></section>
      <section className="portal-card management-list">
      {loading?<div className="loading-card">Chargement…</div>:pageRows.map(item=><article key={item.slug} className="management-row">
        <div className="management-row__main management-row__main--news"><div className="management-news-thumb">{dataProfile.reduced?<span className="media-light-placeholder" aria-label="Image différée en mode léger">Image différée</span>:<img src={item.image} alt="" loading="lazy" decoding="async" width="320" height="180" fetchPriority="low"/>}</div><div><span>{item.category}</span><h3>{item.title}</h3><p>{item.excerpt}</p></div></div>
        <div className="management-row__actions"><button className="secondary-action" onClick={()=>navigate(`/agent/news/${item.slug}`)}>Consulter →</button></div>
      </article>)}
      {!loading&&!rows.length?<div className="dashboard-empty">Aucune publication correspondante.</div>:null}
      {!loading&&rows.length?<PortalPagination page={page} totalPages={totalPages} totalItems={rows.length} perPage={perPage} onPageChange={setPage} itemLabel="publication" itemLabelPlural="publications"/>:null}
    </section></main>
  </div></div>;
}
