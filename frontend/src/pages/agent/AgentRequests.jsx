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
          <section className="toolbar-card toolbar-card--stack" aria-label="Filtres des demandes">
            <div className="toolbar-line">
              <label className="portal-search">
                <span aria-hidden="true">⌕</span>
                <input aria-label="Rechercher une demande citoyenne" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, citoyen, catégorie..." />
              </label>
              <label>
                <span className="sr-only">Filtrer par service</span>
                <select aria-label="Filtrer par service" value={service} onChange={(event) => setService(event.target.value)}>
                  {serviceOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="filter-row filter-row--portal" role="group" aria-label="Filtrer par statut">
              {filters.map((item) => <button type="button" aria-pressed={filter === item} key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
          </section>

          <section className="portal-card">
            <div className="accessible-table-wrap">
              <table className="accessible-table">
                <caption className="sr-only">Liste des demandes citoyennes</caption>
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Citoyen / demande</th>
                    <th scope="col">Service</th>
                    <th scope="col">Lieu</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.ref}>
                      <td className="mono">{row.ref}</td>
                      <td><strong>{row.citizen}</strong><small>{row.title || row.category || "Demande citoyenne"}</small></td>
                      <td>{row.service}</td>
                      <td>{row.location?.label || "—"}</td>
                      <td><span className={`status-pill status-${row.status.replaceAll(" ", "-").toLowerCase()}`}>{row.status}</span></td>
                      <td><button className="accessible-table__action" type="button" onClick={() => navigate(`/agent/requests/${row.ref}`)} aria-label={`Ouvrir la demande ${row.ref}`}>Ouvrir <span aria-hidden="true">→</span></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
