import { useEffect, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getCitizensPage } from "../../api/citizens.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

export default function AgentCitizens(){
  const [items,setItems]=useState([]),[count,setCount]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [filters,setFilters]=useState({search:"",active:"",email_verified:"",district:""});
  const [page,setPage]=useState(1);
  const perPage=12;
  useEffect(()=>{
    let active=true;const timer=window.setTimeout(()=>{setLoading(true);setError("");getCitizensPage({...filters,page,page_size:perPage}).then(page=>{if(active){setItems(page.results);setCount(page.count)}}).catch(e=>active&&setError(getApiErrorMessage(e,"Impossible de charger les citoyens."))).finally(()=>active&&setLoading(false))},180);
    return()=>{active=false;window.clearTimeout(timer)};
  },[filters,page]);
  useEffect(()=>{setPage(1)},[filters.search,filters.active,filters.email_verified,filters.district]);
  const totalPages=Math.max(1,Math.ceil(count/perPage));
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Population" title="Citoyens"/>
    <main className="portal-content agent-citizens-v50">
      {error?<div className="error-card" role="alert">{error}</div>:null}
      <section className="toolbar-card toolbar-card--stack">
        <div className="toolbar-line agent-filter-grid">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un citoyen" value={filters.search} onChange={e=>setFilters(v=>({...v,search:e.target.value}))} placeholder="Nom, e-mail, téléphone, quartier..."/></label>
          <label><span className="sr-only">État du compte</span><select value={filters.active} onChange={e=>setFilters(v=>({...v,active:e.target.value}))}><option value="">Tous les comptes</option><option value="true">Actifs</option><option value="false">Inactifs</option></select></label>
          <label><span className="sr-only">Vérification e-mail</span><select value={filters.email_verified} onChange={e=>setFilters(v=>({...v,email_verified:e.target.value}))}><option value="">Tous les e-mails</option><option value="true">E-mail vérifié</option><option value="false">Non vérifié</option></select></label>
          <label><span className="sr-only">Quartier</span><input className="audit-small-input" value={filters.district} onChange={e=>setFilters(v=>({...v,district:e.target.value}))} placeholder="Quartier exact"/></label>
        </div>
      </section>
      <section className="portal-card">
        <div className="portal-card__head"><div><span className="section-label">Administration F34</span><h3>{count} compte{count>1?"s":""} citoyen{count>1?"s":""}</h3></div><span className="request-list-hint">Recherche et filtres serveur</span></div>
        {loading?<div className="loading-card">Chargement…</div>:<div className="accessible-table-wrap"><table className="accessible-table">
          <caption className="sr-only">Liste des citoyens</caption><thead><tr><th scope="col">Citoyen</th><th scope="col">Contact</th><th scope="col">Quartier</th><th scope="col">Activité</th><th scope="col">Dernière connexion</th><th scope="col">Statut</th><th scope="col">Action</th></tr></thead>
          <tbody>{items.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small className="mono">#{c.id}</small></td><td>{c.email||"—"}<small>{c.phone_number||""}</small></td><td>{c.district||"—"}</td><td>{c.requests} demandes<small>{c.appointments} rendez-vous</small></td><td>{c.lastLoginLabel}</td><td><span className={`status-pill ${c.is_active?"status-actif":"status-inactif"}`}>{c.status}</span>{!c.email_verified?<small className="attention-label">E-mail non vérifié</small>:null}</td><td><button type="button" className="accessible-table__action" onClick={()=>navigate(`/agent/citizens/${c.id}`)}>Administrer →</button></td></tr>)}{!items.length?<tr><td colSpan="7"><p className="detail-copy">Aucun citoyen correspondant.</p></td></tr>:null}</tbody>
        </table><PortalPagination page={page} totalPages={totalPages} totalItems={count} perPage={perPage} onPageChange={setPage} itemLabel="citoyen" itemLabelPlural="citoyens"/></div>}
      </section>
    </main>
  </div></div>;
}
