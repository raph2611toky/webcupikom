import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { createCitizenRequest, getCitizenRequests } from "../../api/requests.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { CATEGORY_SERVICE, REQUEST_CATEGORIES, REQUEST_TYPES } from "../../constants/requestOptions.js";
import { navigate } from "../../utils/navigation.js";
import { getLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const FILTER_CODES = ["Toutes", "Envoyée", "En attente", "En traitement", "Action requise", "Terminée"];
const emptyDraft = { type: "signalement", category: "Éclairage public", subject: "", message: "", location: "" };

const EN_FILTER_LABEL = {
  "Toutes": "All",
  "Envoyée": "Sent",
  "En attente": "Pending",
  "En traitement": "In progress",
  "Action requise": "Action required",
  "Terminée": "Completed",
};

const EN_CATEGORY_LABEL = {
  "État civil": "Civil registry",
  "Voirie": "Roads",
  "Eau / assainissement": "Water / sanitation",
  "Éclairage public": "Street lighting",
  "Transport": "Transport",
  "Déchets": "Waste",
  "Services numériques": "Digital services",
  "Autre": "Other",
};

function statusLabel(status, locale) {
  return locale === "en" ? (EN_FILTER_LABEL[status] || status) : status;
}

function findServiceForCategory(services, category) {
  const target = (CATEGORY_SERVICE[category] || category || "").toLowerCase();
  const exact = services.find((service) =>
    String(service.name || "").toLowerCase().includes(target) ||
    target.includes(String(service.name || "").toLowerCase()) ||
    String(service.category || "").toLowerCase().includes(target)
  );
  if (exact) return exact;
  return services.find((service) => String(service.slug || "").toLowerCase() === "administration")
    || services.find((service) => String(service.name || "").toLowerCase().includes("administr"))
    || null;
}

export default function CitizenRequests() {
  const { user } = useAuth();
  const locale = user?.locale || getLocale();
  const ui = locale === "en" ? {
    page: "My requests", eyebrow: "Procedures", newRequest: "+ New request",
    search: "Search a request...", all: "All", sent: "Sent", pending: "Pending",
    processing: "In progress", action: "Action required", done: "Completed",
    ref: "Reference", request: "Request", service: "Service", status: "Status",
    updated: "Updated", open: "Open", empty: "No matching request.",
    help: "Request help", how: "How can we help you?", intro: "Choose your need, then write your message.",
    category: "Category", subject: "Subject", message: "Message",
    subjectPlaceholder: "E.g. Broken street light", messagePlaceholder: "Describe your question or issue simply...",
    addLocation: "+ Add the problem location", hideLocation: "− Hide location",
    where: "Where is the problem?", optional: "optional", destination: "Destination service",
    send: "Send my request →", sending: "Sending...", sentTitle: "Request sent",
    sentText: "Your request has been received. You can now track its status and main steps.",
    close: "Close", track: "Track now →"
  } : null;
  const [filter, setFilter] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [services, setServices] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [showExtras, setShowExtras] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [requestRows, serviceRows] = await Promise.all([getCitizenRequests(), getServices()]);
      setRequests(requestRows);
      setServices(serviceRows);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de charger vos demandes."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    const applyIntent = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") !== "1") return;

      const type = params.get("type");
      const message = params.get("message") || "";
      const subject = params.get("subject") || "";

      setDraft((current) => ({
        ...current,
        type: REQUEST_TYPES.some((item) => item.value === type) ? type : current.type,
        message: message || current.message,
        subject: subject || current.subject,
      }));
      setShowForm(true);
      window.history.replaceState({}, "", "/citizen/requests");
    };

    applyIntent();
    window.addEventListener("popstate", applyIntent);
    return () => window.removeEventListener("popstate", applyIntent);
  }, []);

  const rows = useMemo(() => requests.filter((row) =>
    (filter === "Toutes" || row.status === filter) &&
    (!query || `${row.id} ${row.title} ${row.service}`.toLowerCase().includes(query.toLowerCase()))
  ), [filter, query, requests]);

  const targetService = useMemo(() => findServiceForCategory(services, draft.category), [services, draft.category]);

  function patch(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function close() {
    setShowForm(false);
    setCreated(null);
    setDraft(emptyDraft);
    setShowExtras(false);
    setSending(false);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!targetService) {
      setError("Aucun service municipal n’est disponible pour recevoir cette demande.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const locationLine = draft.location.trim() ? `\n\nLocalisation : ${draft.location.trim()}` : "";
      const contextLine = `\n\nType : ${draft.type} · Catégorie : ${draft.category}`;

      const request = await createCitizenRequest({
        service: Number(targetService.id),
        title: draft.subject.trim(),
        description: `${draft.message.trim()}${locationLine}${contextLine}`,
        priority: draft.type === "assistance" ? "high" : "normal",
      });

      setCreated(request);
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible d’envoyer la demande."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow={ui?.eyebrow || "Démarches"} title={ui?.page || "Mes demandes"} actions={<button className="topbar-cta" onClick={() => setShowForm(true)}>{ui?.newRequest || "+ Nouvelle demande"}</button>} />
        <main className="portal-content">
          {error && !showForm ? <div className="error-card" role="alert">{error}</div> : null}

          <section className="toolbar-card">
            <label className="portal-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={ui?.search || "Rechercher une demande"} placeholder={ui?.search || "Rechercher une demande..."} />
            </label>
            <div className="filter-row filter-row--portal">
              {FILTER_CODES.map((item) => <button className={item === filter ? "is-active" : ""} aria-pressed={item === filter} key={item} onClick={() => setFilter(item)}>{statusLabel(item, locale)}</button>)}
            </div>
          </section>

          <section className="portal-card">
            {loading ? <div className="loading-card">Chargement…</div> :
            <div className="accessible-table-wrap">
              <table className="accessible-table">
                <caption className="sr-only">Mes demandes citoyennes</caption>
                <thead><tr><th scope="col">{ui?.ref || "Référence"}</th><th scope="col">{ui?.request || "Demande"}</th><th scope="col">{ui?.service || "Service"}</th><th scope="col">{ui?.status || "Statut"}</th><th scope="col">{ui?.updated || "Mise à jour"}</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td><strong>{row.title}</strong></td>
                      <td>{row.service}</td>
                      <td><span className={`status-pill status-${String(row.status).replaceAll(" ", "-").toLowerCase()}`}>{statusLabel(row.status, locale)}</span></td>
                      <td>{row.updated}</td>
                      <td><button className="accessible-table__action" type="button" onClick={() => navigate(`/citizen/requests/${encodeURIComponent(row.id)}`)} aria-label={`Ouvrir la demande ${row.id}`}>{ui?.open || "Ouvrir"} <span aria-hidden="true">→</span></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? <div className="dashboard-empty">{ui?.empty || "Aucune demande correspondante."}</div> : null}
            </div>}
          </section>

          {showForm ? (
            <div className="modal-backdrop request-studio-backdrop" onMouseDown={close}>
              <form className="portal-modal request-studio" role="dialog" aria-modal="true" aria-labelledby="request-studio-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
                <button type="button" className="modal-close" onClick={close}>×</button>

                {created ? (
                  <div className="request-studio-success" role="status" aria-live="polite">
                    <i aria-hidden="true">✓</i>
                    <span className="section-label">{ui?.sentTitle || "Demande envoyée"}</span>
                    <h2 id="request-studio-title">{created.reference}</h2>
                    <p>{ui?.sentText || "Votre demande a bien été prise en compte. Vous pouvez maintenant suivre son état et ses principales étapes."}</p>
                    <div><span>{ui?.service || "Service"}</span><b>{created.service}</b><span>{ui?.status || "Statut"}</span><b>{statusLabel(created.status, locale)}</b></div>
                    <div className="request-studio-success__actions">
                      <button type="button" className="secondary-action" onClick={close}>{ui?.close || "Fermer"}</button>
                      <button type="button" className="primary-action" onClick={() => navigate(`/citizen/requests/${encodeURIComponent(created.reference)}`)}>{ui?.track || "Suivre maintenant →"}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="section-label">{ui?.help || "Demander de l’aide"}</span>
                    <h2 id="request-studio-title">{ui?.how || "Comment pouvons-nous vous aider ?"}</h2>
                    <p className="request-studio__intro">{ui?.intro || "Choisissez votre besoin puis écrivez votre message."}</p>

                    <div className="request-studio-types">
                      {REQUEST_TYPES.map((item) => <button type="button" key={item.value} className={draft.type === item.value ? "is-active" : ""} aria-pressed={draft.type === item.value} onClick={() => patch("type", item.value)}><i aria-hidden="true">{item.icon}</i><span>{locale==="en" ? ({
                        question:"Question", signalement:"Report a problem", demarche:"Procedure", suggestion:"Suggestion", assistance:"Assistance"
                      }[item.value] || item.label) : item.label}</span></button>)}
                    </div>

                    <div className="request-studio-grid">
                      <label className="span-2"><span>{ui?.category || "Catégorie"}</span><select value={draft.category} onChange={(event) => patch("category", event.target.value)}>{REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{locale === "en" ? (EN_CATEGORY_LABEL[category] || category) : category}</option>)}</select></label>
                      <label className="span-2"><span>{ui?.subject || "Sujet"}</span><input required value={draft.subject} onChange={(event) => patch("subject", event.target.value)} placeholder={ui?.subjectPlaceholder || "Ex. Lampadaire en panne"} /></label>
                      <label className="span-2"><span>{ui?.message || "Message"}</span><textarea required rows="4" value={draft.message} onChange={(event) => patch("message", event.target.value)} placeholder={ui?.messagePlaceholder || "Expliquez simplement votre question ou votre problème..."} /></label>
                    </div>

                    <button type="button" className="request-studio-extra-toggle" onClick={() => setShowExtras((value) => !value)}>
                      {showExtras ? (ui?.hideLocation || "− Masquer la localisation") : (ui?.addLocation || "+ Ajouter la localisation du problème")}
                    </button>

                    {showExtras ? <div className="request-studio-grid request-studio-grid--extras">
                      <label className="span-2"><span>{ui?.where || "Où se situe le problème ?"} <em>{ui?.optional || "optionnel"}</em></span><input value={draft.location} onChange={(event) => patch("location", event.target.value)} placeholder="Secteur, rue, bâtiment..." /></label>
                    </div> : null}

                    <div className="request-studio-footer">
                      <div><span>{ui?.destination || "Service destinataire"}</span><b>{targetService?.name || "Recherche du service..."}</b></div>
                      <button className="primary-action" type="submit" disabled={sending || !targetService}>{sending ? (ui?.sending || "Envoi...") : (ui?.send || "Envoyer ma demande →")}</button>
                    </div>
                    {error ? <div className="error-card" role="alert">{error}</div> : null}
                  </>
                )}
              </form>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
