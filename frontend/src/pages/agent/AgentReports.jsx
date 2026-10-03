import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequests } from "../../api/requests.js";
import { REPORT_TYPES } from "../../constants/requestOptions.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const STATUS_FILTERS=["Tous","À traiter","En traitement","Action requise","Terminée"];

export default function AgentReports(){
  const [requests,setRequests]=useState([]);
  const [status,setStatus]=useState("Tous");
  const [type,setType]=useState("Tous");
  const [query,setQuery]=useState("");

  useEffect(()=>{
    let active=true;
    getAgentRequests().then(rows=>active&&setRequests(rows.filter(row=>row.requestType==="signalement")));
    return()=>{active=false};
  },[]);

  const rows=useMemo(()=>requests.filter(row=>
    (status==="Tous"||row.status===status) &&
    (type==="Tous"||row.reportType===type) &&
    (!query||`${row.ref} ${row.citizen} ${row.reportType||""} ${row.location?.label||""} ${row.service||""} ${row.title||""}`.toLowerCase().includes(query.toLowerCase()))
  ),[requests,status,type,query]);

  const metrics=useMemo(()=>({
    pending:requests.filter(row=>row.status==="À traiter").length,
    processing:requests.filter(row=>row.status==="En traitement").length,
    action:requests.filter(row=>row.status==="Action requise").length,
    completed:requests.filter(row=>row.status==="Terminée").length,
  }),[requests]);

  const reportTypes=useMemo(()=>[
    "Tous",
    ...new Set([
      ...REPORT_TYPES.map(item=>item.label),
      ...requests.map(row=>row.reportType).filter(Boolean),
    ])
  ],[requests]);

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Interventions terrain" title="Signalements citoyens"/>
      <main className="portal-content agent-report-page">
        <section className="metric-grid metric-grid--4 report-agent-metrics">
          <article><span>À traiter</span><strong>{metrics.pending}</strong><small>Nouvelle intervention</small></article>
          <article><span>En traitement</span><strong>{metrics.processing}</strong><small>Agent mobilisé</small></article>
          <article><span>Action requise</span><strong>{metrics.action}</strong><small>Information manquante</small></article>
          <article><span>Terminés</span><strong>{metrics.completed}</strong><small>Historique résolu</small></article>
        </section>

        <section className="toolbar-card toolbar-card--stack" aria-label="Filtres des signalements">
          <div className="toolbar-line">
            <label className="portal-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, citoyen, type, lieu..." aria-label="Rechercher un signalement"/>
            </label>
            <label>
              <span className="sr-only">Filtrer par type</span>
              <select value={type} onChange={e=>setType(e.target.value)} aria-label="Filtrer par type de signalement">
                {reportTypes.map(item=><option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="filter-row filter-row--portal">
            {STATUS_FILTERS.map(item=><button type="button" key={item} className={status===item?"is-active":""} aria-pressed={status===item} onClick={()=>setStatus(item)}>{item}</button>)}
          </div>
        </section>

        <section className="portal-card report-agent-table-card">
          <div className="accessible-table-wrap">
            <table className="accessible-table report-agent-table">
              <caption className="sr-only">Signalements citoyens à traiter</caption>
              <thead><tr>
                <th scope="col">Référence</th>
                <th scope="col">Type</th>
                <th scope="col">Citoyen</th>
                <th scope="col">Lieu signalé</th>
                <th scope="col">Service</th>
                <th scope="col">Priorité</th>
                <th scope="col">Statut</th>
                <th scope="col">Action</th>
              </tr></thead>
              <tbody>{rows.map(row=><tr key={row.ref}>
                <td className="mono">{row.ref}</td>
                <td><strong>{row.reportType||row.category||"Signalement"}</strong><small>{row.title}</small></td>
                <td>{row.citizen}</td>
                <td>
                  <span className="report-location-cell">{row.location?.label||"Non précisé"}</span>
                  {row.location?.latitude!=null?<small>⌖ {row.location.latitude}, {row.location.longitude}</small>:null}
                </td>
                <td>{row.service}</td>
                <td><span className={`priority-pill priority-${String(row.priority).toLowerCase()}`}>{row.priority}</span></td>
                <td><span className={`status-pill status-${String(row.status).replaceAll(" ","-").toLowerCase()}`}>{row.status}</span></td>
                <td><button className="accessible-table__action" type="button" onClick={()=>navigate(`/agent/requests/${encodeURIComponent(row.ref)}`)}>Ouvrir →</button></td>
              </tr>)}</tbody>
            </table>
            {!rows.length?<div className="dashboard-empty">Aucun signalement correspondant.</div>:null}
          </div>
        </section>
      </main>
    </div>
  </div>;
}
