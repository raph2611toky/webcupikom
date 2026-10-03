import { useEffect, useMemo, useRef, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { createCitizenRequest, getCitizenRequests } from "../../api/requests.js";
import { currentCitizen } from "../../data/mockData.js";
import { CATEGORY_SERVICE, REQUEST_CATEGORIES, REQUEST_TYPES } from "../../constants/requestOptions.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const filters = ["Toutes", "Envoyée", "En attente", "En traitement", "Action requise", "Terminée"];
const emptyDraft = { type: "signalement", category: "Éclairage public", subject: "", message: "", location: "" };

export default function CitizenRequests() {
  const [filter, setFilter] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState(null);
  const [showExtras, setShowExtras] = useState(false);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(null);
  const fileRef = useRef(null);

  async function refresh() {
    setRequests(await getCitizenRequests());
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
  }

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    const request = await createCitizenRequest({
      source: "citizen",
      type: draft.type,
      category: draft.category,
      service,
      subject: draft.subject,
      message: draft.message,
      citizen: { id: currentCitizen.id, name: `${currentCitizen.firstName} ${currentCitizen.lastName}` },
      contact: { name: `${currentCitizen.firstName} ${currentCitizen.lastName}`, email: currentCitizen.email },
      location: draft.location ? { label: draft.location } : null,
      attachments: file ? [file] : [],
    });
    setCreated(request);
    setSending(false);
    await refresh();
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Démarches" title="Mes demandes" actions={<button className="topbar-cta" onClick={() => setShowForm(true)}>+ Nouvelle demande</button>} />
        <main className="portal-content">
          <section className="toolbar-card">
            <label className="portal-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher une demande" placeholder="Rechercher une demande..." /></label>
            <div className="filter-row filter-row--portal">{filters.map((item) => <button className={item === filter ? "is-active" : ""} aria-pressed={item === filter} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
          </section>

          <section className="portal-card">
            <div className="accessible-table-wrap">
              <table className="accessible-table">
                <caption className="sr-only">Mes demandes citoyennes</caption>
                <thead><tr><th scope="col">Référence</th><th scope="col">Demande</th><th scope="col">Service</th><th scope="col">Statut</th><th scope="col">Mise à jour</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td><strong>{row.title}</strong></td>
                      <td>{row.service}</td>
                      <td><span className={`status-pill status-${row.status.replaceAll(" ", "-").toLowerCase()}`}>{row.status}</span></td>
                      <td>{row.updated}</td>
                      <td><button className="accessible-table__action" type="button" onClick={() => navigate(`/citizen/requests/${row.id}`)} aria-label={`Ouvrir la demande ${row.id}`}>Ouvrir <span aria-hidden="true">→</span></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {showForm ? (
            <div className="modal-backdrop request-studio-backdrop" onClick={close}>
              <form className="portal-modal request-studio" role="dialog" aria-modal="true" aria-labelledby="request-studio-title" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
                <button type="button" className="modal-close" onClick={close}>×</button>
                {created ? (
                  <div className="request-studio-success" role="status" aria-live="polite">
                    <i aria-hidden="true">✓</i><span className="section-label">Demande créée</span><h2 id="request-studio-title">{created.reference}</h2>
                    <p>Votre signalement est enregistré et apparaît déjà dans votre suivi citoyen.</p>
                    <div><span>Service</span><b>{created.service}</b><span>Statut</span><b>En attente</b></div>
                    <div className="request-studio-success__actions"><button type="button" className="secondary-action" onClick={close}>Fermer</button><button type="button" className="primary-action" onClick={() => navigate(`/citizen/requests/${created.reference}`)}>Suivre maintenant →</button></div>
                  </div>
                ) : (
                  <>
                    <span className="section-label">Demander de l’aide</span>
                    <h2 id="request-studio-title">Comment pouvons-nous vous aider ?</h2>
                    <p className="request-studio__intro">Choisissez votre besoin puis écrivez votre message.</p>

                    <div className="request-studio-types">
                      {REQUEST_TYPES.map((item) => <button type="button" key={item.value} className={draft.type === item.value ? "is-active" : ""} aria-pressed={draft.type === item.value} onClick={() => patch("type", item.value)}><i>{item.icon}</i><span>{item.label}</span></button>)}
                    </div>

                    <div className="request-studio-grid">
                      <label className="span-2"><span>Catégorie</span><select value={draft.category} onChange={(event) => patch("category", event.target.value)}>{REQUEST_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
                      <label className="span-2"><span>Sujet</span><input required value={draft.subject} onChange={(event) => patch("subject", event.target.value)} placeholder="Ex. Lampadaire en panne" /></label>
                      <label className="span-2"><span>Message</span><textarea required rows="4" value={draft.message} onChange={(event) => patch("message", event.target.value)} placeholder="Expliquez simplement votre question ou votre problème..." /></label>
                    </div>

                    <button type="button" className="request-studio-extra-toggle" onClick={() => setShowExtras((value) => !value)}>
                      {showExtras ? "− Masquer les détails optionnels" : "+ Ajouter un lieu ou une pièce jointe"}
                    </button>

                    {showExtras ? <div className="request-studio-grid request-studio-grid--extras">
                      <label><span>Lieu <em>optionnel</em></span><input value={draft.location} onChange={(event) => patch("location", event.target.value)} placeholder="Secteur, rue, bâtiment" /></label>
                      <div className="request-studio-file"><span>Pièce jointe <em>optionnel</em></span><input ref={fileRef} hidden type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /><button type="button" onClick={() => fileRef.current?.click()}>{file ? `✓ ${file.name}` : "+ Photo ou document"}</button></div>
                    </div> : null}

                    <div className="request-studio-footer"><div><span>Service destinataire</span><b>{service}</b></div><button className="primary-action" type="submit" disabled={sending}>{sending ? "Création..." : "Envoyer ma demande →"}</button></div>
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
