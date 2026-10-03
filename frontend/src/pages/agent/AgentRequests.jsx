import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const filters=["Toutes","Envoyée","À traiter","En traitement","Action requise","Terminée"];

export default function AgentRequests(){
  const [items,setItems]=useState([]);
  const [services,setServices]=useState([]);
  const [filter,setFilter]=useState("Toutes");
  const [query,setQuery]=useState("");
  const [service,setService]=useState("Tous");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    Promise.all([getAgentRequests(),getServices()])
      .then(([r,s])=>{if(!mounted)return;setItems(r);setServices(s)})
      .catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger les demandes.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[]);

  const rows=useMemo(()=>items.filter(r=>
    (filter==="Toutes"||r.status===filter)&&
    (service==="Tous"||String(r.serviceId)===service)&&
    (!query||`${r.ref} ${r.citizen} ${r.service}`.toLowerCase().includes(query.toLowerCase()))
  ),[items,filter,query,service]);

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Traitement" title="Demandes citoyennes"/>
      <main className="portal-content">
        {error?<div className="error-card" role="alert">{error}</div>:null}

        <section className="toolbar-card toolbar-card--stack">
          <div className="toolbar-line">
            <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une demande" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, service..."/></label>
            <select aria-label="Filtrer par service" value={service} onChange={e=>setService(e.target.value)}><option value="Tous">Tous les services</option>{services.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}</select>
          </div>
          <div className="filter-row filter-row--portal">{filters.map(f=><button key={f} className={filter===f?"is-active":""} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
        </section>

        <section className="portal-card">
          {loading?<div className="loading-card">Chargement…</div>:
          <div className="accessible-table-wrap">
            <table className="accessible-table">
              <caption className="sr-only">Liste des demandes citoyennes</caption>
              <thead><tr><th scope="col">Référence</th><th scope="col">Citoyen</th><th scope="col">Service</th><th scope="col">Priorité</th><th scope="col">Statut</th><th scope="col">Action</th></tr></thead>
              <tbody>{rows.map(r=><tr key={r.ref}>
                <td className="mono">{r.ref}</td><td><strong>{r.citizen}</strong></td><td>{r.service}</td><td>{r.priority}</td>
                <td><span className={`status-pill status-${String(r.status).replaceAll(" ","-").toLowerCase()}`}>{r.status}</span></td>
                <td><button className="accessible-table__action" onClick={()=>navigate(`/agent/requests/${encodeURIComponent(r.ref)}`)}>Ouvrir →</button></td>
              </tr>)}</tbody>
            </table>
            {!rows.length?<div className="dashboard-empty">Aucune demande correspondante.</div>:null}
          </div>}
        </section>
      </main>
    </div>
  </div>;
}
