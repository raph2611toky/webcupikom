import { useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { citizens } from "../../data/mockData.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentCitizens() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => citizens.filter((c) => !q || `${c.name} ${c.id} ${c.district}`.toLowerCase().includes(q.toLowerCase())), [q]);

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Population" title="Citoyens"/>
      <main className="portal-content">
        <section className="toolbar-card">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un citoyen" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Rechercher un citoyen..."/></label>
        </section>
        <section className="portal-card">
          <div className="accessible-table-wrap">
            <table className="accessible-table">
              <caption className="sr-only">Liste des citoyens</caption>
              <thead><tr><th scope="col">Citoyen</th><th scope="col">ID</th><th scope="col">District</th><th scope="col">Demandes</th><th scope="col">Statut</th><th scope="col">Action</th></tr></thead>
              <tbody>{rows.map((c)=><tr key={c.id}><td><strong>{c.name}</strong></td><td className="mono">{c.id}</td><td>{c.district}</td><td>{c.requests}</td><td><span className="status-pill status-actif">{c.status}</span></td><td><button type="button" className="accessible-table__action" onClick={()=>navigate(`/agent/citizens/${c.id}`)} aria-label={`Ouvrir la fiche de ${c.name}`}>Ouvrir <span aria-hidden="true">→</span></button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  </div>;
}
