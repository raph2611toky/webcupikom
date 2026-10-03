import { useEffect, useMemo, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getAgentRequestById, updateRequestStatus } from "../../api/requests.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

function displayDate(value) {
  if (!value) return "En attente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(",", " ·");
}

export default function AgentRequestDetails({ params }) {
  const [request, setRequest] = useState(null);
  const [status, setStatus] = useState("À traiter");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getAgentRequestById(params.id).then((row) => {
      setRequest(row);
      if (row) setStatus(row.status);
    });
  }, [params.id]);

  const history = useMemo(() => request?.history?.length ? request.history : [
    { label: "Demande reçue", at: request?.created || "Aujourd’hui", state: "done" },
    { label: "Qualification automatique", at: request?.service || "Service municipal", state: "done" },
    { label: "En attente d’action agent", at: "Maintenant", state: "next" },
  ], [request]);

  if (!request) return <div className="portal-layout"><AgentSidebar /><div className="portal-main"><PortalTopbar eyebrow="Dossier citoyen" title={`Demande ${params.id}`} /><main className="portal-content"><section className="portal-card">Chargement du dossier…</section></main></div></div>;

  async function changeStatus(nextStatus) {
    setStatus(nextStatus);
    const updated = await updateRequestStatus(request.ref, nextStatus);
    if (updated) {
      setNotice(`Statut mis à jour : ${nextStatus}. Le citoyen pourra être notifié.`);
      setRequest(await getAgentRequestById(request.ref));
      window.setTimeout(() => setNotice(""), 2200);
    }
  }

  return (
    <div className="portal-layout">
      <AgentSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Dossier citoyen" title={`Demande ${request.ref}`} />
        <main className="portal-content">
          <button className="back-link" onClick={() => navigate(request.requestType === "signalement" ? "/agent/signalements" : "/agent/requests")}>
            ← {request.requestType === "signalement" ? "Retour aux signalements" : "Retour aux demandes"}
          </button>
          <section className="agent-detail-head agent-detail-head--smart">
            <div><span>{request.category || request.service}</span><h2>{request.title || request.citizen}</h2><p>{request.citizen} · {request.citizenId} · créée {request.created}</p></div>
            <div className="agent-detail-controls"><label><span>Statut</span><select value={status} onChange={(event) => changeStatus(event.target.value)}><option>À traiter</option><option>En traitement</option><option>Action requise</option><option>Terminée</option></select></label><label><span>Priorité</span><select defaultValue={request.priority}><option>Normale</option><option>Haute</option></select></label></div>
          </section>
          {notice ? <div className="agent-inline-notice">✓ {notice}</div> : null}

          <section className="portal-grid portal-grid--detail agent-smart-grid">
            <article className="portal-card">
              <span className="section-label">Besoin exprimé</span><h3>{request.requestType === "signalement" ? "Signalement citoyen" : "Demande citoyenne"}</h3><p className="detail-copy">{request.description || `Le citoyen signale un besoin lié au service ${request.service}.`}</p>
              <div className="detail-list compact-detail-list">
                {request.requestType === "signalement" ? <div><span>Type de signalement</span><b>{request.reportType || request.category || "Signalement"}</b></div> : null}
                <div><span>Catégorie</span><b>{request.category || request.service}</b></div>
                <div><span>Service orienté</span><b>{request.service}</b></div>
                <div><span>Lieu signalé</span><b>{request.location?.label || "Non précisé"}</b></div>
              </div>
              {request.location?.latitude ? <div className="request-location-map"><span>⌖ Localisation transmise</span><b>{request.location.latitude}, {request.location.longitude}</b><small>Précision indiquée par l’appareil : {request.location.accuracy || "—"} m</small></div> : null}
            </article>

            <article className="portal-card"><span className="section-label">Historique</span><h3>Journal du dossier</h3><div className="activity-feed">{history.slice(0, 5).map((item, index) => <div key={`${item.label}-${index}`}><i>{item.state === "done" ? "●" : "○"}</i><div><b>{item.label}</b><span>{item.at ? displayDate(item.at) : "Étape suivante"}</span></div></div>)}</div></article>

            <article className="portal-card portal-card--wide agent-evidence-card">
              <div><span className="section-label">Pièces jointes</span><h3>Éléments utiles à l’intervention</h3></div>
              {request.attachments?.length ? <div className="document-grid">{request.attachments.map((file) => <div className="document-row" key={file.name}><i>{file.type?.includes("image") ? "IMG" : "DOC"}</i><div><b>{file.name}</b><span>{Math.max(1, Math.round((file.size || 0) / 1024))} Ko · transmis par le citoyen</span></div><button>Ouvrir</button></div>)}</div> : <span className="empty-inline">Aucun document joint.</span>}
            </article>

            <article className="portal-card portal-card--wide agent-action-card"><div><span className="section-label">Actions rapides</span><h3>Faire avancer le dossier</h3></div><div className="action-buttons"><button className="secondary-action" onClick={() => changeStatus("En traitement")}>Prendre en charge</button><button className="secondary-action" onClick={() => changeStatus("Action requise")}>Demander une information</button><button className="primary-action" onClick={() => changeStatus("Terminée")}>Marquer résolue</button></div></article>
          </section>
        </main>
      </div>
    </div>
  );
}
