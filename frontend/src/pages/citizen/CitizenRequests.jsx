import { useEffect, useMemo, useRef, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createCitizenRequest, getCitizenRequests } from "../../api/requests.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { CATEGORY_SERVICE, REQUEST_CATEGORIES, REQUEST_TYPES } from "../../constants/requestOptions.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const filters = ["Toutes", "Envoyée", "En attente", "En traitement", "Action requise", "Terminée"];
const emptyDraft = { type: "signalement", category: "Éclairage public", subject: "", message: "", location: "" };

const COPY = {
  fr: {
    eyebrow:"Démarches", title:"Mes demandes", new:"+ Nouvelle demande", search:"Rechercher une demande...",
    tableCaption:"Mes demandes citoyennes", ref:"Référence", request:"Demande", service:"Service", status:"Statut",
    updated:"Mise à jour", action:"Action", open:"Ouvrir", empty:"Aucune demande correspondante.",
    created:"Demande créée", createdText:"Votre demande est enregistrée et apparaît déjà dans votre suivi citoyen.",
    pending:"En attente", close:"Fermer", track:"Suivre maintenant →", help:"Demander de l’aide",
    how:"Comment pouvons-nous vous aider ?", intro:"Choisissez votre besoin puis écrivez votre message.",
    category:"Catégorie", subject:"Sujet", subjectPh:"Ex. Lampadaire en panne", message:"Message",
    messagePh:"Expliquez simplement votre question ou votre problème...", hideExtras:"− Masquer les détails optionnels",
    showExtras:"+ Ajouter un lieu ou une pièce jointe", location:"Lieu", optional:"optionnel",
    locationPh:"Secteur, rue, bâtiment", attachment:"Pièce jointe", file:"+ Photo ou document",
    destination:"Service destinataire", creating:"Création...", send:"Envoyer ma demande →",
    loadError:"Impossible de charger vos demandes.", sendError:"Impossible d’envoyer la demande.",
  },
  en: {
    eyebrow:"Procedures", title:"My requests", new:"+ New request", search:"Search a request...",
    tableCaption:"My citizen requests", ref:"Reference", request:"Request", service:"Service", status:"Status",
    updated:"Updated", action:"Action", open:"Open", empty:"No matching request.",
    created:"Request created", createdText:"Your request has been recorded and is already available in your citizen tracking.",
    pending:"Pending", close:"Close", track:"Track now →", help:"Request help",
    how:"How can we help you?", intro:"Choose what you need, then write your message.",
    category:"Category", subject:"Subject", subjectPh:"E.g. broken street light", message:"Message",
    messagePh:"Describe your question or problem simply...", hideExtras:"− Hide optional details",
    showExtras:"+ Add a location or attachment", location:"Location", optional:"optional",
    locationPh:"Area, street, building", attachment:"Attachment", file:"+ Photo or document",
    destination:"Destination service", creating:"Creating...", send:"Send my request →",
    loadError:"Unable to load your requests.", sendError:"Unable to send the request.",
  },
  mg: {
    eyebrow:"Dingana", title:"Ny fangatahako", new:"+ Fangatahana vaovao", search:"Hitady fangatahana...",
    tableCaption:"Ny fangatahan'ny mponina", ref:"Laharana", request:"Fangatahana", service:"Sampan-draharaha", status:"Sata",
    updated:"Fanavaozana", action:"Hetsika", open:"Hanokatra", empty:"Tsy misy fangatahana mifanaraka.",
    created:"Vita ny fangatahana", createdText:"Voaray ny fangatahanao ary efa hita ao amin'ny fanaraha-maso anao.",
    pending:"Miandry", close:"Hakatona", track:"Hanaraka izao →", help:"Hangataka fanampiana",
    how:"Ahoana no ahafahanay manampy anao?", intro:"Safidio ny filànao ary soraty ny hafatrao.",
    category:"Sokajy", subject:"Lohateny", subjectPh:"Ohatra: jiro an-dalambe simba", message:"Hafatra",
    messagePh:"Hazavao amin'ny fomba tsotra ny fanontanianao na ny olanao...", hideExtras:"− Afeno ny antsipiriany fanampiny",
    showExtras:"+ Ampio toerana na rakitra", location:"Toerana", optional:"tsy voatery",
    locationPh:"Faritra, arabe, trano", attachment:"Rakitra", file:"+ Sary na antontan-taratasy",
    destination:"Sampan-draharaha handray", creating:"Mamorona...", send:"Handefa ny fangatahana →",
    loadError:"Tsy afaka mampiseho ny fangatahana.", sendError:"Tsy afaka mandefa ny fangatahana.",
  },
};

const FILTER_LABELS = {
  fr: {},
  en: {
    "Toutes":"All", "Envoyée":"Sent", "En attente":"Pending", "En traitement":"In progress",
    "Action requise":"Action required", "Terminée":"Completed",
  },
  mg: {
    "Toutes":"Rehetra", "Envoyée":"Nalefa", "En attente":"Miandry", "En traitement":"Eo am-pikarakarana",
    "Action requise":"Mila hetsika", "Terminée":"Vita",
  },
};

const TYPE_LABELS = {
  en:{question:"Question",signalement:"Report a problem",demarche:"Procedure",suggestion:"Suggestion",assistance:"Assistance"},
  mg:{question:"Fanontaniana",signalement:"Hitatitra olana",demarche:"Dingana",suggestion:"Soso-kevitra",assistance:"Fanampiana"},
};

const CATEGORY_LABELS = {
  en:{
    "État civil":"Civil registry","Voirie":"Roads","Eau / assainissement":"Water / sanitation",
    "Éclairage public":"Street lighting","Transport":"Transport","Déchets":"Waste",
    "Services numériques":"Digital services","Autre":"Other",
  },
  mg:{
    "État civil":"Soram-panjakana","Voirie":"Lalana","Eau / assainissement":"Rano / fanadiovana",
    "Éclairage public":"Jiro an-dalambe","Transport":"Fitaterana","Déchets":"Fako",
    "Services numériques":"Sampan-draharaha nomerika","Autre":"Hafa",
  },
};

function statusLabel(value, locale) {
  return FILTER_LABELS[locale]?.[value] || value;
}

export default function CitizenRequests() {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [filter, setFilter] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState(null);
  const [showExtras, setShowExtras] = useState(false);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(null);
  const [error,setError]=useState("");
  const fileRef = useRef(null);

  async function refresh() {
    try {
      setRequests(await getCitizenRequests());
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, copy.loadError));
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
    (!query || `${row.id} ${row.title} ${row.service} ${row.category || ""}`.toLowerCase().includes(query.toLowerCase()))
  ), [filter, query, requests]);

  const service = CATEGORY_SERVICE[draft.category] || "Administration";

  function patch(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function close() {
    setShowForm(false);
    setCreated(null);
    setDraft(emptyDraft);
    setFile(null);
    setShowExtras(false);
    setSending(false);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const request = await createCitizenRequest({
        source: "citizen",
        type: draft.type,
        category: draft.category,
        service,
        subject: draft.subject,
        message: draft.message,
        location: draft.location ? { label: draft.location } : null,
        attachments: file ? [file] : [],
      });
      setCreated(request);
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, copy.sendError));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} actions={<button className="topbar-cta" onClick={() => setShowForm(true)}>{copy.new}</button>} />
        <main className="portal-content">
          {error && !showForm ? <div className="error-card" role="alert">{error}</div> : null}
          <section className="toolbar-card">
            <label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={copy.search} placeholder={copy.search} /></label>
            <div className="filter-row filter-row--portal">{filters.map((item) => <button className={item === filter ? "is-active" : ""} aria-pressed={item === filter} key={item} onClick={() => setFilter(item)}>{statusLabel(item, locale)}</button>)}</div>
          </section>

          <section className="portal-card">
            <div className="accessible-table-wrap">
              <table className="accessible-table">
                <caption className="sr-only">{copy.tableCaption}</caption>
                <thead><tr><th scope="col">{copy.ref}</th><th scope="col">{copy.request}</th><th scope="col">{copy.service}</th><th scope="col">{copy.status}</th><th scope="col">{copy.updated}</th><th scope="col">{copy.action}</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td><strong>{row.title}</strong></td>
                      <td>{row.service}</td>
                      <td><span className={`status-pill status-${String(row.status).replaceAll(" ", "-").toLowerCase()}`}>{statusLabel(row.status,locale)}</span></td>
                      <td>{row.updated}</td>
                      <td><button className="accessible-table__action" type="button" onClick={() => navigate(`/citizen/requests/${encodeURIComponent(row.id)}`)} aria-label={`${copy.open} ${row.id}`}>{copy.open} <span aria-hidden="true">→</span></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? <div className="dashboard-empty">{copy.empty}</div> : null}
            </div>
          </section>

          {showForm ? (
            <div className="modal-backdrop request-studio-backdrop" onClick={close}>
              <form className="portal-modal request-studio" role="dialog" aria-modal="true" aria-labelledby="request-studio-title" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
                <button type="button" className="modal-close" onClick={close}>×</button>
                {created ? (
                  <div className="request-studio-success" role="status" aria-live="polite">
                    <i aria-hidden="true">✓</i><span className="section-label">{copy.created}</span><h2 id="request-studio-title">{created.reference}</h2>
                    <p>{copy.createdText}</p>
                    <div><span>{copy.service}</span><b>{created.service}</b><span>{copy.status}</span><b>{statusLabel(created.status || "En attente",locale)}</b></div>
                    <div className="request-studio-success__actions"><button type="button" className="secondary-action" onClick={close}>{copy.close}</button><button type="button" className="primary-action" onClick={() => navigate(`/citizen/requests/${encodeURIComponent(created.reference)}`)}>{copy.track}</button></div>
                  </div>
                ) : (
                  <>
                    <span className="section-label">{copy.help}</span>
                    <h2 id="request-studio-title">{copy.how}</h2>
                    <p className="request-studio__intro">{copy.intro}</p>

                    <div className="request-studio-types">
                      {REQUEST_TYPES.map((item) => <button type="button" key={item.value} className={draft.type === item.value ? "is-active" : ""} aria-pressed={draft.type === item.value} onClick={() => patch("type", item.value)}><i aria-hidden="true">{item.icon}</i><span>{TYPE_LABELS[locale]?.[item.value] || item.label}</span></button>)}
                    </div>

                    <div className="request-studio-grid">
                      <label className="span-2"><span>{copy.category}</span><select value={draft.category} onChange={(event) => patch("category", event.target.value)}>{REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[locale]?.[category] || category}</option>)}</select></label>
                      <label className="span-2"><span>{copy.subject}</span><input required value={draft.subject} onChange={(event) => patch("subject", event.target.value)} placeholder={copy.subjectPh} /></label>
                      <label className="span-2"><span>{copy.message}</span><textarea required rows="4" value={draft.message} onChange={(event) => patch("message", event.target.value)} placeholder={copy.messagePh} /></label>
                    </div>

                    <button type="button" className="request-studio-extra-toggle" onClick={() => setShowExtras((value) => !value)}>
                      {showExtras ? copy.hideExtras : copy.showExtras}
                    </button>

                    {showExtras ? <div className="request-studio-grid request-studio-grid--extras">
                      <label><span>{copy.location} <em>{copy.optional}</em></span><input value={draft.location} onChange={(event) => patch("location", event.target.value)} placeholder={copy.locationPh} /></label>
                      <div className="request-studio-file"><span>{copy.attachment} <em>{copy.optional}</em></span><input ref={fileRef} hidden type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /><button type="button" onClick={() => fileRef.current?.click()}>{file ? `✓ ${file.name}` : copy.file}</button></div>
                    </div> : null}

                    <div className="request-studio-footer"><div><span>{copy.destination}</span><b>{service}</b></div><button className="primary-action" type="submit" disabled={sending}>{sending ? copy.creating : copy.send}</button></div>
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
