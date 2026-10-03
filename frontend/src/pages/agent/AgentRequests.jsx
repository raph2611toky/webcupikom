import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequests } from "../../api/requests.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const filters = ["Toutes", "À traiter", "En traitement", "Action requise", "Terminée"];

export default function AgentRequests() {
  const [filter, setFilter] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [service, setService] = useState("Tous");
  const [requests, setRequests] = useState([]);

  useEffect(() => { getAgentRequests().then(setRequests); }, []);

  const serviceOptions = useMemo(() => ["Tous", ...new Set(requests.map((row) => row.service))], [requests]);
  const rows = useMemo(() => requests.filter((row) =>
    (filter === "Toutes" || row.status === filter) &&
    (service === "Tous" || row.service === service) &&
    (!query || `${row.ref} ${row.citizen} ${row.service} ${row.category || ""} ${row.title || ""}`.toLowerCase().includes(query.toLowerCase()))
  ), [filter, query, service, requests]);

  return (
    <div className="portal-layout">
      <AgentSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Traitement" title="Demandes citoyennes" />
        <main className="portal-content">
          <section className="toolbar-card toolbar-card--stack">
            <div className="toolbar-line"><label className="portal-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, citoyen, catégorie..." /></label><select value={service} onChange={(event) => setService(event.target.value)}>{serviceOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter-row filter-row--portal">{filters.map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
          </section>

          <section className="portal-card agent-request-board">
            <div className="portal-table portal-table--agent portal-table--agent-smart">
              <div className="portal-table__head"><span>Référence</span><span>Citoyen / demande</span><span>Service</span><span>Lieu</span><span>Statut</span><span /></div>
              {rows.map((row) => <button className="portal-table__row" key={row.ref} onClick={() => navigate(`/agent/requests/${row.ref}`)}><span className="mono">{row.ref}</span><span><strong>{row.citizen}</strong><small>{row.title || row.category || "Demande citoyenne"}</small></span><span>{row.service}</span><span>{row.location?.label || "—"}</span><span><em className={`status-pill status-${row.status.replaceAll(" ", "-").toLowerCase()}`}>{row.status}</em></span><span>→</span></button>)}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
