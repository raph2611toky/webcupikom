import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getCitizens } from "../../api/citizens.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentCitizens() {
  const [items,setItems]=useState([]);
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    getCitizens()
      .then(data=>mounted&&setItems(data))
      .catch(e=>mounted&&setError(getApiErrorMessage(e,"Impossible de charger les citoyens.")))
      .finally(()=>mounted&&setLoading(false));
    return()=>{mounted=false};
  },[]);

  const rows=useMemo(
    ()=>items.filter(c=>!q||`${c.name} ${c.id} ${c.email}`.toLowerCase().includes(q.toLowerCase())),
    [items,q]
  );

  return <div className="portal-layout">
    <AgentSidebar/>
    <div className="portal-main">
      <PortalTopbar eyebrow="Population" title="Citoyens"/>
      <main className="portal-content">
        {error?<div className="error-card" role="alert">{error}</div>:null}
        <section className="toolbar-card">
          <label className="portal-search">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Rechercher un citoyen" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Rechercher un citoyen..."/>
          </label>
        </section>

        <section className="portal-card">
          {loading?<div className="loading-card">Chargement…</div>:
          <div className="accessible-table-wrap">
            <table className="accessible-table">
              <caption className="sr-only">Liste des citoyens</caption>
              <thead>
                <tr>
                  <th scope="col">Citoyen</th>
                  <th scope="col">ID</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Demandes</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c)=><tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td className="mono">#{c.id}</td>
                  <td>{c.email||"—"}</td>
                  <td>{c.requests}</td>
                  <td><span className={`status-pill ${c.is_active?"status-actif":"status-inactif"}`}>{c.status}</span></td>
                  <td>
                    <button
                      type="button"
                      className="accessible-table__action"
                      onClick={()=>navigate(`/agent/citizens/${c.id}`)}
                      aria-label={`Ouvrir la fiche de ${c.name}`}
                    >
                      Ouvrir <span aria-hidden="true">→</span>
                    </button>
                  </td>
                </tr>)}
              </tbody>
            </table>
            {!rows.length?<div className="dashboard-empty">Aucun citoyen correspondant.</div>:null}
          </div>}
        </section>
      </main>
    </div>
  </div>;
}
