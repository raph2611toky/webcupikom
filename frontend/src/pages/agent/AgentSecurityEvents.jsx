import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import PortalPagination from "../../components/ui/PortalPagination.jsx";
import { getAccountSecurityEvents } from "../../api/securityEvents.js";
import { getApiErrorMessage } from "../../api/auth.js";
import "../../styles/pages/agent-security-events.css";

const PER_PAGE = 50;

function relativeAge(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "date inconnue";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function detailValue(value) {
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

export default function AgentSecurityEvents() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getAccountSecurityEvents({ page });
        if (!mounted) return;
        setItems(result.results || []);
        setCount(result.count || 0);
        setSelected((current) => {
          if (current && (result.results || []).some((item) => item.id === current.id)) return current;
          return result.results?.[0] || null;
        });
      } catch (err) {
        if (!mounted) return;
        setItems([]);
        setCount(0);
        setSelected(null);
        setError(getApiErrorMessage(err, "Impossible de charger les événements de sécurité."));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));
  const summary = useMemo(() => ({
    newDevices: items.filter((item) => item.kind === "new_device_login").length,
    sensitiveChanges: items.filter((item) => /^(password_|email_|mfa_)/.test(item.kind)).length,
    revoked: items.filter((item) => item.kind === "session_revoked" || item.kind === "sessions_revoked").length,
  }), [items]);

  return <div className="portal-layout"><AgentSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Sécurité du compte" title="Événements de sécurité" actions={<button type="button" className="secondary-action" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>{loading ? "Actualisation…" : "Actualiser"}</button>} />
    <main className="portal-content agent-security-page">
      <section className="portal-card agent-security-intro">
        <div>
          <span className="section-label">Suivi quotidien</span>
          <h2>Derniers événements de sécurité</h2>
          <p>Connexions, nouveaux appareils, changements sensibles et révocations de session du compte agent actuellement connecté.</p>
        </div>
        <div className="agent-security-intro__count" aria-label={`${count} événements de sécurité`}><strong>{count}</strong><span>événement{count > 1 ? "s" : ""}</span></div>
      </section>

      {error ? <div className="agent-soft-warning" role="alert">{error}</div> : null}

      <section className="agent-security-stats" aria-label="Résumé des événements visibles">
        <article><span>Nouveaux appareils</span><strong>{summary.newDevices}</strong><small>sur cette page</small></article>
        <article><span>Changements sensibles</span><strong>{summary.sensitiveChanges}</strong><small>mot de passe, e-mail ou MFA</small></article>
        <article><span>Sessions révoquées</span><strong>{summary.revoked}</strong><small>sur cette page</small></article>
      </section>

      <section className="agent-security-layout">
        <article className="portal-card agent-security-list-card">
          <div className="portal-card__head"><div><span className="section-label">Chronologie</span><h3>Événements récents</h3></div><small>Plus récent en premier</small></div>
          {loading ? <div className="loading-card">Chargement des événements de sécurité…</div> : <div className="agent-security-list">
            {items.map((item) => <button type="button" key={item.id} className={`agent-security-event is-${item.tone} ${selected?.id === item.id ? "is-active" : ""}`} onClick={() => setSelected(item)}>
              <span className="agent-security-event__icon" aria-hidden="true">{item.icon}</span>
              <span className="agent-security-event__copy"><strong>{item.title}</strong><small>{item.group} · {relativeAge(item.createdAt)}</small>{item.device || item.ipAddress ? <em>{[item.device, item.ipAddress].filter(Boolean).join(" · ")}</em> : null}</span>
              <span className="agent-security-event__date">{item.createdLabel}</span>
            </button>)}
            {!items.length ? <p className="detail-copy">Aucun événement de sécurité enregistré pour ce compte.</p> : null}
          </div>}
          {!loading && count > PER_PAGE ? <PortalPagination page={page} totalPages={totalPages} totalItems={count} perPage={PER_PAGE} onPageChange={(next) => { setPage(next); setSelected(null); }} itemLabel="événement" itemLabelPlural="événements" /> : null}
        </article>

        <aside className="portal-card agent-security-detail" aria-live="polite">
          <span className="section-label">Détail</span>
          <h3>{selected?.title || "Sélectionnez un événement"}</h3>
          {selected ? <>
            <div className="agent-security-detail__meta">
              <span className={`agent-security-badge is-${selected.tone}`}>{selected.group}</span>
              <span>{selected.createdLabel}</span>
            </div>
            <dl>
              <div><dt>Type technique</dt><dd className="mono">{detailValue(selected.kind)}</dd></div>
              <div><dt>Appareil</dt><dd>{detailValue(selected.device)}</dd></div>
              <div><dt>Adresse IP</dt><dd>{detailValue(selected.ipAddress)}</dd></div>
              <div><dt>Session</dt><dd className="mono">{detailValue(selected.sessionId)}</dd></div>
              <div><dt>Motif</dt><dd>{detailValue(selected.reason)}</dd></div>
              {selected.method || selected.path ? <div><dt>Action API</dt><dd>{[selected.method, selected.path].filter(Boolean).join(" · ")}</dd></div> : null}
            </dl>
            <p className="agent-security-detail__note">Ce journal est fourni par le backend de sécurité du compte. Il ne contient pas les mots de passe, codes MFA, jetons ou cookies.</p>
          </> : <p className="detail-copy">Cliquez sur une ligne pour consulter le contexte disponible.</p>}
        </aside>
      </section>
    </main>
  </div></div>;
}
