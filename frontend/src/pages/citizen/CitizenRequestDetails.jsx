import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { addRequestInformation, getCitizenRequestById } from "../../api/requests.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const fallbackTimeline = [
  { label: "Demande envoyée", at: "03 octobre · 08:30", state: "done" },
  { label: "Demande reçue", at: "03 octobre · 08:31", state: "done" },
  { label: "En traitement", at: "03 octobre · 09:15", state: "current" },
  { label: "Intervention", at: "Étape suivante", state: "next" },
];

function displayDate(value) {
  if (!value) return "En attente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(",", " ·");
}

export default function CitizenRequestDetails({ params }) {
  const [request, setRequest] = useState(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCitizenRequestById(params.id).then(setRequest);
  }, [params.id]);

  const timeline = useMemo(() => {
    if (!request?.history?.length) return fallbackTimeline;
    const done = request.history.filter((item) => item.state === "done");
    const next = request.history.filter((item) => item.state !== "done");
    const currentIndex = Math.max(0, done.length - 1);
    return [...done, ...next].map((item, index) => ({
      ...item,
      at: item.at ? displayDate(item.at) : "Étape suivante",
      state: item.state === "done" && index === currentIndex ? "current" : item.state,
    }));
  }, [request]);

  if (!request) return <div className="portal-layout"><CitizenSidebar /><div className="portal-main"><PortalTopbar eyebrow="Suivi de demande" title={params.id} /><main className="portal-content"><section className="portal-card">Chargement du dossier…</section></main></div></div>;

  async function saveNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    await addRequestInformation(request.id, note.trim());
    setSaved(true);
    setNote("");
    window.setTimeout(() => { setShowNote(false); setSaved(false); }, 650);
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Suivi de demande" title={request.id} />
        <main className="portal-content">
          <button className="back-link" onClick={() => navigate("/citizen/requests")}>← Retour à mes demandes</button>
          <section className="request-detail-hero">
            <div><span>{request.category || request.service}</span><h2>{request.title}</h2><p>{request.description}</p></div>
            <em className={`status-pill status-${request.status.replaceAll(" ", "-").toLowerCase()}`}>{request.status}</em>
          </section>

          <section className="portal-grid portal-grid--detail">
            <article className="portal-card">
              <span className="section-label">Suivi</span><h3>Avancement de la demande</h3>
              <div className="timeline">{timeline.slice(0, 5).map((item, index) => <div key={`${item.label}-${index}`} className={item.state === "done" ? "done" : item.state === "current" ? "current" : ""}><i>{item.state === "done" ? "✓" : item.state === "current" ? "●" : "○"}</i><div><b>{item.label}</b><span>{item.at}</span></div></div>)}</div>
            </article>

            <article className="portal-card">
              <span className="section-label">Informations</span><h3>Détails du signalement</h3>
              <div className="detail-list">
                <div><span>Service</span><b>{request.service}</b></div>
                <div><span>Catégorie</span><b>{request.category || "—"}</b></div>
                <div><span>Lieu</span><b>{request.location?.label || request.district || "Non précisé"}</b></div>
                <div><span>Dernière mise à jour</span><b>{request.updated}</b></div>
              </div>
              {request.location?.latitude ? <div className="request-location-chip">⌖ {request.location.latitude}, {request.location.longitude}</div> : null}
            </article>

            <article className="portal-card portal-card--wide request-attachments-card">
              <div className="portal-card__head"><div><span className="section-label">Pièces jointes</span><h3>Éléments transmis</h3></div><button onClick={() => setShowNote(true)}>+ Ajouter une information</button></div>
              {request.attachments?.length ? <div className="document-grid">{request.attachments.map((file) => <div className="document-row" key={file.name}><i>{file.type?.includes("image") ? "IMG" : "PDF"}</i><div><b>{file.name}</b><span>{Math.max(1, Math.round((file.size || 0) / 1024))} Ko · joint à la demande</span></div><button>Voir</button></div>)}</div> : <div className="empty-inline">Aucune pièce jointe pour cette demande.</div>}
            </article>

            <article className="action-bar portal-card--wide">
              <div><b>Besoin d’ajouter une précision ?</b><span>Complétez le dossier ici sans quitter votre espace citoyen.</span></div>
              <div><button className="secondary-action" onClick={() => setShowNote(true)}>Ajouter une information</button><button className="primary-action" onClick={() => navigate("/citizen/notifications")}>Voir mes notifications</button></div>
            </article>
          </section>

          {showNote ? <div className="modal-backdrop" onClick={() => setShowNote(false)}><form className="portal-modal compact-note-modal" onClick={(event) => event.stopPropagation()} onSubmit={saveNote}><button type="button" className="modal-close" onClick={() => setShowNote(false)}>×</button><span className="section-label">Compléter le dossier</span><h2>{saved ? "Information ajoutée ✓" : "Ajouter une précision"}</h2><p>Votre message sera rattaché à {request.id} et visible par l’agent chargé du dossier.</p><label><span>Message</span><textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ajoutez une information utile..." /></label><button className="primary-action" type="submit">Enregistrer →</button></form></div> : null}
        </main>
      </div>
    </div>
  );
}
