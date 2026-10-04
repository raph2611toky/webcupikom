import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getAdminContactMessages } from "../../api/contact.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
export default function AdminMessages(){
  const [items,setItems]=useState([]),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getAdminContactMessages().then(data=>mounted&&setItems(data)).catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger les messages."))).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[]);
  const rows=useMemo(()=>items.filter(x=>(filter==='all'||x.statusCode===filter)&&(!query||`${x.reference} ${x.name} ${x.email} ${x.subject}`.toLowerCase().includes(query.toLowerCase()))),[items,query,filter]);
  const perPage=10;
  const totalPages=Math.max(1,Math.ceil(rows.length/perPage));
  const pageRows=rows.slice((page-1)*perPage,page*perPage);
  useEffect(()=>setPage(1),[query,filter]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  return <div className="portal-layout"><AdminSidebar/><div className="portal-main"><PortalTopbar eyebrow="Relations citoyennes" title="Messages"/><main className="portal-content">{error?<div className="error-card">{error}</div>:null}<section className="toolbar-card toolbar-card--stack"><div className="toolbar-line"><label className="portal-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, nom, sujet..."/></label></div><div className="filter-row filter-row--portal">{[['all','Tous'],['received','Reçus'],['read','Lus'],['closed','Clôturés']].map(([v,l])=><button key={v} className={filter===v?'is-active':''} onClick={()=>setFilter(v)}>{l}</button>)}</div></section><section className="portal-card">{loading?<div className="loading-card">Chargement…</div>:<div className="portal-table portal-table--messages"><div className="portal-table__head"><span>Référence</span><span>Expéditeur</span><span>Sujet</span><span>Statut</span><span>Date</span><span/></div>{pageRows.map(item=><button className="portal-table__row" key={item.reference} onClick={()=>navigate(`/admin/messages/${encodeURIComponent(item.reference)}`)}><span className="mono">{item.reference}</span><strong>{item.name}</strong><span>{item.subject}</span><span><em className={`status-pill status-${item.statusCode}`}>{item.statusLabel}</em></span><span>{item.createdLabel}</span><span>→</span></button>)}{!rows.length?<p className="detail-copy">Aucun message correspondant.</p>:null}<PortalPagination page={page} totalPages={totalPages} totalItems={rows.length} perPage={perPage} onPageChange={setPage} itemLabel="message" itemLabelPlural="messages"/></div>}</section></main></div></div>;
}
