import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getAdminRequestSummary, getAdminRequestsPage, getAgentRequestSummary, getAgentRequestsPage } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import useRealtimeRefresh from "../../realtime/useRealtimeRefresh.js";

const REQUESTS_PER_PAGE = 8;

const FLOW_FILTERS = [
  ["all", "Toutes"],
  ["awaiting_handling", "À prendre en charge"],
  ["agent_processing", "En traitement"],
  ["citizen_action_required", "Attente citoyen"],
  ["needs_action", "Action requise"],
  ["closed", "Clôturées"],
];

function initialFilters() {
  const q = new URLSearchParams(window.location.search);
  return {
    workflow: q.get("workflow") || "all",
    query: q.get("search") || "",
    service: q.get("service") || "",
    priority: q.get("priority") || "",
    type: q.get("type") || "",
    reply: q.get("reply") || "all",
  };
}

function requestTypeLabel(row) {
  return row.requestType === "signalement" || row.requestType === "report" ? "Signalement" : "Démarche";
}

export default function AgentRequests({ mode = "agent" } = {}) {
  const isAdmin = mode === "admin";
  const Sidebar = isAdmin ? AdminSidebar : AgentSidebar;
  const listRequests = isAdmin ? getAdminRequestsPage : getAgentRequestsPage;
  const loadSummary = isAdmin ? getAdminRequestSummary : getAgentRequestSummary;
  const requestBase = isAdmin ? "/admin/requests" : "/agent/requests";
  const initial = initialFilters();
  if (new URLSearchParams(window.location.search).get("needs_action") === "true") initial.workflow = "needs_action";

  const [filters, setFilters] = useState(initial);
  const [rows, setRows] = useState([]);
  const [services, setServices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [metrics, setMetrics] = useState({ awaiting: 0, action: 0, processing: 0, waitingCitizen: 0, answered: 0, awaitingReply: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  useRealtimeRefresh("nova-requests-updated", () => setRealtimeVersion((value) => value + 1));

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);
  useEffect(() => {
    loadSummary().then((summary) => setMetrics({
      awaiting: Number(summary.awaiting_handling || 0),
      action: Number(summary.needs_agent_action ?? summary.needs_action ?? 0),
      processing: Number(summary.in_progress ?? summary.agent_processing ?? 0),
      waitingCitizen: Number(summary.waiting_citizen ?? summary.action_required ?? 0),
      answered: Number(summary.answered || 0),
      awaitingReply: Number(summary.awaiting_first_reply || 0),
    })).catch(() => {});
  }, [isAdmin, realtimeVersion]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = { page, page_size: REQUESTS_PER_PAGE, search: filters.query, service: filters.service, priority: filters.priority, type: filters.type };
      if (filters.reply === "answered") params.has_agent_reply = true;
      if (filters.reply === "unanswered") params.has_agent_reply = false;
      if (filters.workflow === "needs_action") params.needs_action = true;
      else if (filters.workflow === "awaiting_handling") params.awaiting_handling = true;
      else if (filters.workflow !== "all") params.workflow_state = filters.workflow;
      listRequests(params)
        .then((result) => {
          if (!active) return;
          setRows(result.results);
          setTotal(result.count);
          setHasNext(Boolean(result.next));
          setHasPrevious(Boolean(result.previous));
        })
        .catch((e) => active && setError(getApiErrorMessage(e, "Impossible de charger les demandes.")))
        .finally(() => active && setLoading(false));
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [filters, page, realtimeVersion]);

  const hasFilters = useMemo(() => filters.workflow !== "all" || filters.query || filters.service || filters.priority || filters.type || filters.reply !== "all", [filters]);
  const totalPages = Math.max(1, Math.ceil(total / REQUESTS_PER_PAGE));
  const setWorkflow = (workflow) => { setFilters((value) => ({ ...value, workflow })); setPage(1); };

  return (
    <div className="portal-layout">
      <Sidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow={isAdmin ? "Administration" : "Traitement"} title={isAdmin ? "Supervision des demandes" : "Suivi des demandes"} />
        <main className="portal-content agent-requests-v92">
          {error ? <div className="error-card" role="alert">{error}</div> : null}

          <section className="agent-queue-overview" aria-label="Résumé de la file de demandes">
            <button type="button" className={filters.workflow === "awaiting_handling" ? "is-active" : ""} onClick={() => setWorkflow("awaiting_handling")}>
              <span>À prendre en charge</span><strong>{metrics.awaiting}</strong><small>Nouveaux dossiers</small>
            </button>
            <button type="button" className={filters.workflow === "needs_action" ? "is-active" : ""} onClick={() => setWorkflow("needs_action")}>
              <span>Action requise</span><strong>{metrics.action}</strong><small>À traiter maintenant</small>
            </button>
            <button type="button" className={filters.workflow === "agent_processing" ? "is-active" : ""} onClick={() => setWorkflow("agent_processing")}>
              <span>En traitement</span><strong>{metrics.processing}</strong><small>Dossiers actifs</small>
            </button>
            <button type="button" className={filters.workflow === "citizen_action_required" ? "is-active" : ""} onClick={() => setWorkflow("citizen_action_required")}>
              <span>Attente citoyen</span><strong>{metrics.waitingCitizen}</strong><small>Retour attendu</small>
            </button>
          </section>

          <section className="agent-request-commandbar" aria-label="Recherche et filtres des demandes">
            <div className="agent-request-commandbar__top">
              <label className="agent-filter-control agent-filter-control--search">
                <span>Recherche</span>
                <span className="portal-search"><i aria-hidden="true">⌕</i><input aria-label="Rechercher une demande citoyenne" value={filters.query} onChange={(e) => { setFilters((value) => ({ ...value, query: e.target.value })); setPage(1); }} placeholder="Référence, citoyen, description..." /></span>
              </label>
              <label className="agent-filter-control"><span>Service</span><select value={filters.service} onChange={(e) => { setFilters((value) => ({ ...value, service: e.target.value })); setPage(1); }}><option value="">Tous les services</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
              <label className="agent-filter-control"><span>Priorité</span><select value={filters.priority} onChange={(e) => { setFilters((value) => ({ ...value, priority: e.target.value })); setPage(1); }}><option value="">Toutes</option><option value="urgent">Urgente</option><option value="high">Haute</option><option value="normal">Normale</option><option value="low">Basse</option></select></label>
              <label className="agent-filter-control"><span>Type</span><select value={filters.type} onChange={(e) => { setFilters((value) => ({ ...value, type: e.target.value })); setPage(1); }}><option value="">Tous</option><option value="procedure">Démarches</option><option value="report">Signalements</option></select></label>
              <label className="agent-filter-control"><span>Communication</span><select value={filters.reply} onChange={(e) => { setFilters((value) => ({ ...value, reply: e.target.value })); setPage(1); }}><option value="all">Toutes</option><option value="unanswered">Sans réponse</option><option value="answered">Avec réponse</option></select></label>
            </div>
            <div className="agent-request-commandbar__bottom">
              <div className="agent-flow-filters" role="group" aria-label="État de traitement">
                {FLOW_FILTERS.map(([value, label]) => <button type="button" aria-pressed={filters.workflow === value} key={value} className={filters.workflow === value ? "is-active" : ""} onClick={() => setWorkflow(value)}>{label}</button>)}
              </div>
              <div className="agent-reply-summary" aria-label="Résumé des réponses">
                <span><b>{metrics.answered}</b> répondues</span>
                <span className={metrics.awaitingReply ? "needs-reply" : ""}><b>{metrics.awaitingReply}</b> sans première réponse</span>
              </div>
              {hasFilters ? <button className="agent-filter-reset" type="button" onClick={() => { setFilters({ workflow: "all", query: "", service: "", priority: "", type: "", reply: "all" }); setPage(1); }}>Réinitialiser</button> : null}
            </div>
          </section>

          <section className="agent-worklist portal-card">
            <div className="agent-worklist__head">
              <div><span className="section-label">File de travail</span><h3>{total} demande{total > 1 ? "s" : ""}</h3></div>
              <span>Tri et filtres appliqués côté serveur</span>
            </div>

            {loading ? <div className="loading-card">Chargement…</div> : (
              <div className="agent-request-list" role="list" aria-label="Liste des demandes citoyennes">
                <div className="agent-request-list__columns" aria-hidden="true">
                  <span>Référence</span><span>Dossier</span><span>Priorité</span><span>Statut</span><span>Communication</span><span>Responsable</span><span>Actions</span>
                </div>
                {rows.map((row) => (
                  <article role="listitem" key={row.ref} className={`agent-request-item ${row.requiresAgentAction ? "is-attention" : ""}`}>
                    <div className="agent-request-item__ref">
                      <strong className="mono">{row.ref}</strong>
                      <span>{requestTypeLabel(row)}</span>
                      <small>{row.updated ? `Mis à jour ${row.updated}` : ""}</small>
                    </div>

                    <div className="agent-request-item__main">
                      <strong>{row.title || row.category || "Demande citoyenne"}</strong>
                      <span>{row.citizen}</span>
                      <small>{row.service}{row.needsTriage ? " · À router" : ""}</small>
                    </div>

                    <div className="agent-request-item__priority">
                      <span className={`priority-badge priority-${row.priorityCode}`}>{row.priority}</span>
                    </div>

                    <div className="agent-request-item__workflow">
                      <span className={`status-pill status-${String(row.status).replaceAll(" ", "-").toLowerCase()}`}>{row.workflowLabel || row.status}</span>
                      {row.requiresAgentAction ? <small className="attention-label">Action attendue</small> : row.requiresCitizenAction ? <small className="citizen-wait-label">Attente citoyen</small> : null}
                    </div>

                    <div className="agent-request-item__signals">
                      {row.requestType === "signalement" || row.requestType === "report" ? <span>♡ {row.supportCount || 0} soutien{Number(row.supportCount || 0) > 1 ? "s" : ""}</span> : null}
                      {row.hasAgentReply ? <span className="has-reply">↩ {row.agentReplyCount} réponse{row.agentReplyCount > 1 ? "s" : ""}</span> : <span className="needs-reply">Sans réponse</span>}
                    </div>

                    <div className="agent-request-item__owner">
                      <small>Responsable</small>
                      <strong>{row.assignedToName || "Non assigné"}</strong>
                    </div>

                    <button className="agent-request-item__open" type="button" onClick={() => navigate(`${requestBase}/${encodeURIComponent(row.ref)}`)} aria-label={`Ouvrir la demande ${row.ref}`}>Ouvrir <span aria-hidden="true">→</span></button>
                  </article>
                ))}
                {!rows.length ? <div className="agent-worklist__empty"><span>⌕</span><strong>Aucune demande pour ces filtres.</strong><small>Modifiez les filtres ou réinitialisez la recherche.</small></div> : null}
              </div>
            )}

            {total > 0 ? <PortalPagination page={page} totalPages={totalPages} totalItems={total} perPage={REQUESTS_PER_PAGE} onPageChange={setPage} itemLabel="demande" itemLabelPlural="demandes" className="agent-worklist__pagination" /> : null}
          </section>
        </main>
      </div>
    </div>
  );
}
