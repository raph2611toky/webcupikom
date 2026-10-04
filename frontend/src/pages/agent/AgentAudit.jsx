import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentAudit, getAgentAuditEvent } from "../../api/audit.js";
import { getApiErrorMessage } from "../../api/auth.js";

const RESOURCE_LABELS = { request: "Demande", appointment: "Rendez-vous", citizen: "Citoyen", service: "Service", publication: "Publication" };

function initialFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return {
    search: q.get("search") || "",
    resource_type: q.get("resource_type") || "",
    resource_id: q.get("resource_id") || "",
    action: q.get("action") || "",
    mine: q.get("mine") === "true",
    date_from: q.get("date_from") || "",
    date_to: q.get("date_to") || "",
  };
}

function formatAuditValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const rendered = value.map((entry) => formatAuditValue(entry)).filter(Boolean);
    return rendered.length ? rendered.join(", ") : "—";
  }
  if (typeof value === "object") {
    const parts = [
      value.display_name,
      value.name,
      value.title,
      value.label,
      value.reference,
      value.email,
      value.role,
      value.status_label,
      value.status,
      value.id,
    ].filter((entry, index, array) => entry !== undefined && entry !== null && entry !== "" && array.indexOf(entry) === index);
    if (parts.length) return parts.join(" · ");
    try { return JSON.stringify(value); }
    catch { return Object.keys(value).join(", ") || "—"; }
  }
  return String(value);
}

function changeRows(changes = {}) {
  return Object.entries(changes).map(([key, value]) => ({
    key,
    from: value && typeof value === "object" && !Array.isArray(value) && ("from" in value || "to" in value) ? value.from : undefined,
    to: value && typeof value === "object" && !Array.isArray(value) && ("from" in value || "to" in value) ? value.to : value,
  }));
}

export default function AgentAudit() {
  const [filters, setFilters] = useState(initialFromUrl);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getAgentAudit({ ...filters, mine: filters.mine ? "true" : undefined, page_size: 100 })
        .then((page) => {
          if (!active) return;
          setItems(page.results);
          setCount(page.count);
        })
        .catch((e) => active && setError(getApiErrorMessage(e, "Impossible de charger le journal d’activité.")))
        .finally(() => active && setLoading(false));
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters]);

  async function openEvent(item) {
    try {
      setSelected(await getAgentAuditEvent(item.id));
    } catch {
      setSelected(item);
    }
  }

  const activeFilters = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  return <div className="portal-layout"><AgentSidebar /><div className="portal-main">
    <PortalTopbar eyebrow="Traçabilité" title="Journal d’activité" />
    <main className="portal-content agent-audit-page">
      {error ? <div className="error-card" role="alert">{error}</div> : null}
      <section className="portal-card audit-intro-card">
        <div><span className="section-label">F47 · F48</span><h3>Qui a modifié quoi ?</h3><p className="detail-copy">Toutes les actions tracées par le backend sont consultables avec leur auteur, la ressource concernée, la date et les changements.</p></div>
        <div className="audit-count"><strong>{count}</strong><span>événements trouvés</span></div>
      </section>

      <section className="toolbar-card toolbar-card--stack audit-toolbar" aria-label="Filtres du journal d’activité">
        <div className="toolbar-line">
          <label className="portal-search"><span aria-hidden="true">⌕</span><input value={filters.search} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value }))} placeholder="Résumé, référence, auteur..." aria-label="Rechercher dans le journal" /></label>
          <label><span className="sr-only">Type de ressource</span><select value={filters.resource_type} onChange={(e) => setFilters((v) => ({ ...v, resource_type: e.target.value }))}><option value="">Toutes les ressources</option><option value="request">Demandes</option><option value="appointment">Rendez-vous</option><option value="citizen">Citoyens</option><option value="service">Services</option><option value="publication">Publications</option></select></label>
          <label><span className="sr-only">Action</span><input className="audit-small-input" value={filters.action} onChange={(e) => setFilters((v) => ({ ...v, action: e.target.value }))} placeholder="request.update" /></label>
        </div>
        <div className="audit-filter-line">
          <label><span>Du</span><input type="date" value={filters.date_from} onChange={(e) => setFilters((v) => ({ ...v, date_from: e.target.value }))} /></label>
          <label><span>Au</span><input type="date" value={filters.date_to} onChange={(e) => setFilters((v) => ({ ...v, date_to: e.target.value }))} /></label>
          <label className="audit-check"><input type="checkbox" checked={filters.mine} onChange={(e) => setFilters((v) => ({ ...v, mine: e.target.checked }))} /><span>Uniquement mes actions</span></label>
          {activeFilters ? <button className="secondary-action" type="button" onClick={() => setFilters({ search: "", resource_type: "", resource_id: "", action: "", mine: false, date_from: "", date_to: "" })}>Réinitialiser</button> : null}
        </div>
      </section>

      <section className="portal-grid audit-layout">
        <article className="portal-card audit-list-card">
          <div className="portal-card__head"><div><span className="section-label">Historique</span><h3>Actions du personnel</h3></div></div>
          {loading ? <div className="loading-card">Chargement…</div> : <div className="audit-list">
            {items.map((item) => <button type="button" key={item.id} className={selected?.id === item.id ? "is-active" : ""} onClick={() => openEvent(item)}>
              <span className="audit-dot" aria-hidden="true">●</span>
              <div>
                <strong>{formatAuditValue(item.summary)}</strong>
                <span>{formatAuditValue(item.actorName)} · {item.createdLabel}</span>
                <small>{RESOURCE_LABELS[item.resourceType] || item.resourceType || "Ressource"} {item.resourceReference || item.resourceId ? `· ${formatAuditValue(item.resourceReference || item.resourceId)}` : ""}</small>
              </div>
              <em>{formatAuditValue(item.action)}</em>
            </button>)}
            {!items.length ? <p className="detail-copy">Aucune action correspondant aux filtres.</p> : null}
          </div>}
        </article>

        <article className="portal-card audit-detail-card">
          <span className="section-label">Détail</span><h3>{selected?.summary ? formatAuditValue(selected.summary) : "Sélectionnez une action"}</h3>
          {selected ? <>
            <div className="detail-list">
              <div><span>Auteur</span><b>{formatAuditValue(selected.actorName)} ({formatAuditValue(selected.actorRole)})</b></div>
              <div><span>Action</span><b className="mono">{formatAuditValue(selected.action)}</b></div>
              <div><span>Ressource</span><b>{RESOURCE_LABELS[selected.resourceType] || selected.resourceType} {selected.resourceReference || selected.resourceId ? formatAuditValue(selected.resourceReference || selected.resourceId) : ""}</b></div>
              <div><span>Citoyen concerné</span><b>{formatAuditValue(selected.subject)}</b></div>
              <div><span>Visibilité</span><b>{selected.visibility === "staff" ? "Personnel" : formatAuditValue(selected.visibility)}</b></div>
              <div><span>Date</span><b>{selected.createdLabel}</b></div>
            </div>
            <div className="audit-changes"><h4>Changements</h4>{changeRows(selected.changes).length ? changeRows(selected.changes).map((row) => <div key={row.key}><span>{row.key}</span><del>{formatAuditValue(row.from)}</del><i aria-hidden="true">→</i><ins>{formatAuditValue(row.to)}</ins></div>) : <p className="detail-copy">Aucun détail de changement fourni par l’API.</p>}</div>
          </> : <p className="detail-copy">Cliquez sur une entrée du journal pour afficher les valeurs avant/après lorsqu’elles sont disponibles.</p>}
        </article>
      </section>
    </main>
  </div></div>;
}
