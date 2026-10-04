import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { acknowledgeAgentReportAlert, getAgentRequestCount, getAgentRequests, getAgentUnacknowledgedReportAlerts } from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

const STATUS_OPTIONS = [
  ["", "Tous les statuts"],
  ["awaiting", "À prendre en charge"],
  ["in_progress", "En traitement"],
  ["action_required", "Action requise"],
  ["completed", "Terminés"],
];

const ZONES = [
  { id: "north", label: "QUARTIER NORD", x: 14, y: 12, w: 572, h: 126 },
  { id: "west", label: "QUARTIER OUEST", x: 14, y: 148, w: 164, h: 178 },
  { id: "center", label: "CENTRE-VILLE", x: 191, y: 148, w: 214, h: 178 },
  { id: "east", label: "QUARTIER EST", x: 419, y: 148, w: 167, h: 178 },
  { id: "south", label: "QUARTIER SUD", x: 14, y: 338, w: 572, h: 116 },
];

function hashText(value = "") {
  let hash = 0;
  for (const ch of String(value)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function zoneFor(row) {
  const location = normalize(`${row.district || ""} ${row.location?.label || ""} ${row.street || ""}`);
  if (/nord|north/.test(location)) return ZONES[0];
  if (/ouest|west/.test(location)) return ZONES[1];
  if (/centre|center|central|ville/.test(location)) return ZONES[2];
  if (/est|east/.test(location)) return ZONES[3];
  if (/sud|south/.test(location)) return ZONES[4];
  return ZONES[hashText(row.ref) % ZONES.length];
}

function markerFor(row) {
  const zone = zoneFor(row);
  const h = hashText(`${row.ref}-${row.title}`);
  const margin = 28;
  return {
    x: zone.x + margin + (h % Math.max(1, zone.w - margin * 2)),
    y: zone.y + margin + ((h >>> 8) % Math.max(1, zone.h - margin * 2)),
    urgent: ["urgent", "high"].includes(String(row.priorityCode || "").toLowerCase()),
  };
}

function relativeAge(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "à l’instant";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function formatDateParts(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date).replace(".", ""),
    time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function priorityClass(code) {
  return ["urgent", "high", "low"].includes(code) ? code : "normal";
}

function statusClass(row) {
  if (row.workflowState === "awaiting_handling") return "awaiting";
  if (row.workflowState === "agent_processing" || row.statusCode === "in_progress") return "processing";
  if (row.requiresCitizenAction || row.statusCode === "action_required") return "action";
  if (row.isClosed || row.statusCode === "completed") return "completed";
  return "neutral";
}

function ReportPlan({ rows }) {
  const [selected, setSelected] = useState("");
  const active = rows.find((row) => row.ref === selected) || null;

  return (
    <section className="arp85-plan-shell">
      <div className="arp85-plan-copy">
        <span>PLAN DES SIGNALEMENTS</span>
        <h2>Répartition dans Nova Terra</h2>
        <p>Plan fictif de la ville. Les marqueurs représentent les signalements correspondant aux filtres actuels.</p>
        <div className="arp85-plan-legend">
          <span><i className="normal" /> Normal / bas</span>
          <span><i className="urgent" /> Haute / urgente</span>
        </div>
        {active ? (
          <article className="arp85-plan-selected">
            <strong>{active.reportType || active.category || "Signalement"}</strong>
            <span>{active.ref}</span>
            <p>{active.location?.label || active.district || "Localisation non précisée"}</p>
            <button type="button" onClick={() => navigate(`/agent/requests/${encodeURIComponent(active.ref)}`)}>Ouvrir le dossier →</button>
          </article>
        ) : <small>Sélectionnez un marqueur pour afficher le dossier.</small>}
      </div>
      <div className="arp85-plan-board">
        <svg viewBox="0 0 600 466" role="img" aria-label="Plan fictif des quartiers de Nova Terra et signalements">
          <defs>
            <pattern id="arp85-grid" width="35" height="35" patternUnits="userSpaceOnUse">
              <path d="M 35 0 L 0 0 0 35" fill="none" stroke="rgba(89,255,232,.08)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="600" height="466" rx="0" className="arp85-map-bg" />
          <rect x="0" y="0" width="600" height="466" fill="url(#arp85-grid)" />
          {ZONES.map((zone) => (
            <g key={zone.id}>
              <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} className="arp85-zone" />
              <text x={zone.x + 10} y={zone.y + 22} className="arp85-zone-label">{zone.label}</text>
            </g>
          ))}
          {rows.map((row) => {
            const point = markerFor(row);
            const isSelected = row.ref === selected;
            return (
              <g key={row.ref} className={`arp85-marker ${point.urgent ? "is-urgent" : "is-normal"} ${isSelected ? "is-selected" : ""}`} onClick={() => setSelected(row.ref)} role="button" tabIndex="0" aria-label={`${row.ref}, ${row.reportType || row.category || "signalement"}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(row.ref); }}>
                <circle cx={point.x} cy={point.y} r={isSelected ? 18 : 15} className="arp85-marker-ring" />
                <path d={`M ${point.x} ${point.y - 10} C ${point.x - 8} ${point.y - 10}, ${point.x - 10} ${point.y - 2}, ${point.x} ${point.y + 10} C ${point.x + 10} ${point.y - 2}, ${point.x + 8} ${point.y - 10}, ${point.x} ${point.y - 10} Z`} className="arp85-marker-pin" />
                <circle cx={point.x} cy={point.y - 3} r="3.2" className="arp85-marker-dot" />
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export default function AgentReports() {
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState({ pending: 0, processing: 0, action: 0, completed: 0 });
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [emergencyCount, setEmergencyCount] = useState(0);
  const [acknowledging, setAcknowledging] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(() => new URLSearchParams(window.location.search).get("emergency") === "true");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getAgentRequestCount({ type: "report", awaiting_handling: true }),
      getAgentRequestCount({ type: "report", awaiting_handling: true, handling_route: "emergency" }),
      getAgentRequestCount({ type: "report", status: "in_progress" }),
      getAgentRequestCount({ type: "report", status: "in_progress", handling_route: "emergency" }),
      getAgentRequestCount({ type: "report", status: "action_required" }),
      getAgentRequestCount({ type: "report", status: "action_required", handling_route: "emergency" }),
      getAgentRequestCount({ type: "report", status: "completed" }),
      getAgentRequestCount({ type: "report", status: "completed", handling_route: "emergency" }),
    ]).then(([pending, pendingEmergency, processing, processingEmergency, action, actionEmergency, completed, completedEmergency]) => setMetrics({
      pending: Math.max(0, pending - pendingEmergency),
      processing: Math.max(0, processing - processingEmergency),
      action: Math.max(0, action - actionEmergency),
      completed: Math.max(0, completed - completedEmergency),
    })).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    getAgentUnacknowledgedReportAlerts({ page_size: 8 })
      .then((page) => { if (active) { setEmergencyAlerts(page.results || []); setEmergencyCount(page.count || 0); } })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function acknowledgeEmergency(reference) {
    if (!reference || acknowledging) return;
    setAcknowledging(reference); setError("");
    try {
      await acknowledgeAgentReportAlert(reference);
      setEmergencyAlerts((rows) => rows.filter((row) => row.ref !== reference));
      setEmergencyCount((value) => Math.max(0, value - 1));
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de confirmer la prise en charge de l’urgence."));
    } finally {
      setAcknowledging("");
    }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getAgentRequests({
        type: "report",
        ...(status === "awaiting" ? { awaiting_handling: true } : status ? { status } : {}),
        ...(emergencyOnly ? { handling_route: "emergency" } : {}),
        search: query || undefined,
        page_size: 100,
      })
        .then((rows) => active && setRequests(rows))
        .catch((err) => active && setError(getApiErrorMessage(err, "Impossible de charger les signalements.")))
        .finally(() => active && setLoading(false));
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [status, query, emergencyOnly]);

  const filteredRows = useMemo(() => {
    return requests.filter((row) => {
      if (!emergencyOnly && row.handlingRoute === "emergency") return false;
      if (emergencyOnly && row.handlingRoute !== "emergency") return false;
      const created = row.createdAt ? new Date(row.createdAt) : null;
      if (dateFrom && created && created < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && created && created > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [requests, dateFrom, dateTo, emergencyOnly]);

  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const pageRows = filteredRows.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [status, query, dateFrom, dateTo, emergencyOnly]);

  return (
    <div className="portal-layout">
      <AgentSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Espace agent" title="Signalements citoyens" subtitle="Consultez et traitez les signalements des citoyens." />
        <main className="portal-content arp85-page">
          {error ? <div className="error-card" role="alert">{error}</div> : null}

          {emergencyCount > 0 || emergencyAlerts.length ? <section className="f86-alert-queue" aria-label="Urgences non prises en charge">
            <header><div><span className="f86-siren" aria-hidden="true">!</span><div><strong>URGENCES NON PRISES EN CHARGE — {emergencyCount}</strong><small>Circuit F86 · ces dossiers restent séparés des signalements ordinaires</small></div></div><button type="button" onClick={() => setEmergencyOnly(true)}>Afficher la file urgence</button></header>
            <div className="f86-alert-grid">{emergencyAlerts.slice(0,4).map((row) => <article key={row.ref}><div><span className="mono">{row.ref}</span><strong>{row.category || row.reportType || row.title || "Urgence"}</strong><small>{row.district || row.location?.label || "Localisation à vérifier"} · {relativeAge(row.alertTriggeredAt || row.createdAt)}</small></div><div><button type="button" onClick={() => navigate(`/agent/requests/${encodeURIComponent(row.ref)}`)}>Ouvrir</button><button type="button" className="is-primary" disabled={acknowledging === row.ref} onClick={() => acknowledgeEmergency(row.ref)}>{acknowledging === row.ref ? "Prise en charge…" : "Prendre en charge"}</button></div></article>)}</div>
          </section> : null}

          <section className="arp85-metrics arp85-metrics--f86" aria-label="Résumé des signalements">
            <button type="button" onClick={() => setEmergencyOnly((value) => !value)} className={emergencyOnly ? "is-active is-emergency" : "is-emergency"}>
              <i className="arp85-metric-icon icon-emergency">!</i><span><b>Urgences</b><strong>{emergencyCount}</strong><small>{emergencyOnly ? "File urgence affichée" : "Non acquittées · F86"}</small></span>
            </button>
            <button type="button" onClick={() => { setEmergencyOnly(false); setStatus("awaiting"); }} className={status === "awaiting" ? "is-active" : ""}>
              <i className="arp85-metric-icon icon-pending">▤</i><span><b>À prendre en charge</b><strong>{metrics.pending}</strong><small>Nouveaux signalements</small></span>
            </button>
            <button type="button" onClick={() => { setEmergencyOnly(false); setStatus("in_progress"); }} className={status === "in_progress" ? "is-active" : ""}>
              <i className="arp85-metric-icon">◷</i><span><b>En traitement</b><strong>{metrics.processing}</strong><small>Dossiers en cours</small></span>
            </button>
            <button type="button" onClick={() => { setEmergencyOnly(false); setStatus("action_required"); }} className={status === "action_required" ? "is-active" : ""}>
              <i className="arp85-metric-icon icon-action">!</i><span><b>Action requise</b><strong>{metrics.action}</strong><small>En attente</small></span>
            </button>
            <button type="button" onClick={() => { setEmergencyOnly(false); setStatus("completed"); }} className={status === "completed" ? "is-active" : ""}>
              <i className="arp85-metric-icon">✓</i><span><b>Terminés</b><strong>{metrics.completed}</strong><small>Résolus</small></span>
            </button>
          </section>

          <section className="arp85-toolbar">
            <label className="arp85-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, citoyen, lieu, service..." /></label>
            <label className="arp85-status-select"><select value={status} onChange={(event) => { setEmergencyOnly(false); setStatus(event.target.value); }}>{STATUS_OPTIONS.map(([value, label]) => <option value={value} key={value || "all"}>{label}</option>)}</select></label>
            <div className="arp85-date-range">
              <span aria-hidden="true">▣</span>
              <label><small>Du</small><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <em>au</em>
              <label><small>au</small><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
            </div>
            <div className="arp85-view-switch" role="group" aria-label="Affichage">
              <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>▤ Liste</button>
              <button type="button" className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>⌖ Plan</button>
            </div>
          </section>

          {view === "map" ? (
            <ReportPlan rows={filteredRows} />
          ) : (
            <section className="arp85-table-card">
              {loading ? <div className="arp85-loading">Chargement…</div> : (
                <>
                  <div className="arp85-table-scroll">
                    <table className="arp85-table">
                      <thead><tr><th>Référence</th><th>Type</th><th>Citoyen</th><th>Lieu</th><th>Service</th><th>Priorité</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
                      <tbody>
                        {pageRows.map((row) => {
                          const dateParts = formatDateParts(row.createdAt);
                          return (
                            <tr key={row.ref}>
                              <td className="arp85-ref">{row.ref}</td>
                              <td><div className="arp85-type-cell"><i>{row.reportType?.toLowerCase().includes("eau") ? "◉" : row.reportType?.toLowerCase().includes("déchet") ? "♲" : "!"}</i><span><b>{row.reportType || row.category || "Signalement"}</b><small>{row.title}</small></span></div></td>
                              <td>{row.citizen}</td>
                              <td><div className="arp85-location"><span>{row.location?.label || row.district || "Non précisé"}</span>{row.latitude != null ? <small>⌖ {Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)}</small> : null}</div></td>
                              <td>{row.service}</td>
                              <td><span className={`arp85-priority is-${priorityClass(row.priorityCode)}`}>{row.priority}</span></td>
                              <td><span className={`arp85-status is-${statusClass(row)}`}>{row.workflowLabel || row.status}</span></td>
                              <td><div className="arp85-date"><span>{dateParts.date}</span><small>{dateParts.time}</small></div></td>
                              <td><div className="arp85-actions"><button type="button" onClick={() => navigate(`/agent/requests/${encodeURIComponent(row.ref)}`)}>Ouvrir</button><button type="button" aria-label={`Actions ${row.ref}`} onClick={() => navigate(`/agent/requests/${encodeURIComponent(row.ref)}`)}>•••</button></div></td>
                            </tr>
                          );
                        })}
                        {!pageRows.length ? <tr><td colSpan="9"><div className="arp85-empty">Aucun signalement correspondant.</div></td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                  <footer className="arp85-table-footer">
                    <span>{filteredRows.length} {emergencyOnly ? "urgence" : "signalement"}{filteredRows.length > 1 ? "s" : ""} affiché{filteredRows.length > 1 ? "s" : ""}</span>
                    <div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button><b>{page}</b><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button></div>
                  </footer>
                </>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
