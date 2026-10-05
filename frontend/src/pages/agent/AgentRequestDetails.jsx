import { useEffect, useMemo, useRef, useState } from "react";
import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import {
  addAgentReportAttachments,
  acknowledgeAgentReportAlert,
  acknowledgeAdminReportAlert,
  addAgentRequestTimeline,
  addAdminRequestTimeline,
  downloadRequestAttachment,
  getAgentRequestById,
  getAdminRequestById,
  getAgentSimilarRequests,
  getAdminSimilarRequests,
  getAgentRequestReplies,
  getAdminRequestReplies,
  linkAgentRequestDuplicate,
  linkAdminRequestDuplicate,
  reopenAgentReport,
  sendAgentRequestReply,
  sendAdminRequestReply,
  unlinkAgentRequestDuplicate,
  unlinkAdminRequestDuplicate,
  updateAgentRequest,
  updateAdminRequest,
} from "../../api/requests.js";
import { getAssignees } from "../../api/citizens.js";
import { getServices } from "../../api/services.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate } from "../../utils/navigation.js";

const STATUS_OPTIONS = [
  ["submitted", "Envoyée"],
  ["pending", "À traiter"],
  ["in_progress", "En traitement"],
  ["action_required", "Action requise"],
  ["completed", "Terminée"],
  ["rejected", "Non retenue"],
  ["cancelled", "Annulée"],
];
const PRIORITY_OPTIONS = [["low", "Basse"], ["normal", "Normale"], ["high", "Haute"], ["urgent", "Urgente"]];
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS);
const PRIORITY_LABELS = Object.fromEntries(PRIORITY_OPTIONS);

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date).replace(",", " ·");
}

function fieldLabel(key) {
  return ({ status: "Statut", priority: "Priorité", assigned_to: "Responsable", service: "Service", resolution_summary: "Résumé" })[key] || key;
}

export default function AgentRequestDetails({ params, mode = "agent" }) {
  const isAdmin = mode === "admin";
  const Sidebar = isAdmin ? AdminSidebar : AgentSidebar;
  const requestBase = isAdmin ? "/admin/requests" : "/agent/requests";
  const getRequest = isAdmin ? getAdminRequestById : getAgentRequestById;
  const getSimilar = isAdmin ? getAdminSimilarRequests : getAgentSimilarRequests;
  const linkDuplicate = isAdmin ? linkAdminRequestDuplicate : linkAgentRequestDuplicate;
  const unlinkDuplicate = isAdmin ? unlinkAdminRequestDuplicate : unlinkAgentRequestDuplicate;
  const updateRequest = isAdmin ? updateAdminRequest : updateAgentRequest;
  const addTimelineEvent = isAdmin ? addAdminRequestTimeline : addAgentRequestTimeline;
  const getReplies = isAdmin ? getAdminRequestReplies : getAgentRequestReplies;
  const sendReply = isAdmin ? sendAdminRequestReply : sendAgentRequestReply;
  const acknowledgeAlert = isAdmin ? acknowledgeAdminReportAlert : acknowledgeAgentReportAlert;

  const { user } = useAuth();
  const summaryRef = useRef(null);
  const [request, setRequest] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [services, setServices] = useState([]);
  const [replies, setReplies] = useState([]);
  const [form, setForm] = useState({ status: "pending", priority: "normal", assigned_to: "", service: "", resolution_summary: "" });
  const [note, setNote] = useState({ title: "Note de suivi", message: "", is_public: false });
  const [replyMessage, setReplyMessage] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [reportFiles, setReportFiles] = useState([]);
  const [reportPublic, setReportPublic] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarSearched, setSimilarSearched] = useState(false);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);

  async function load() {
    const [row, people, serviceRows, replyRows] = await Promise.all([
      getRequest(params.id),
      getAssignees(),
      getServices(),
      getReplies(params.id).catch(() => []),
    ]);
    setRequest(row);
    setAssignees(people);
    setServices(serviceRows);
    setReplies(replyRows);
    setForm({
      status: row.statusCode || "pending",
      priority: row.priorityCode || "normal",
      assigned_to: row.assignedTo ?? "",
      service: row.serviceId ?? "",
      resolution_summary: row.resolutionSummary || "",
    });
  }

  useEffect(() => {
    load().catch((e) => setError(getApiErrorMessage(e, "Impossible de charger le dossier.")));
  }, [params.id, mode]);

  const history = useMemo(() => (request?.timeline?.length ? request.timeline : request?.history || []), [request]);
  const sensitiveStatus = ["completed", "rejected", "action_required"].includes(form.status);
  const replyDisabled = request?.statusCode === "cancelled";

  const changePreview = useMemo(() => {
    if (!request) return [];
    const base = {
      status: request.statusCode || "", priority: request.priorityCode || "", assigned_to: request.assignedTo ?? "",
      service: request.serviceId ?? "", resolution_summary: request.resolutionSummary || "",
    };
    return Object.entries(form).flatMap(([key, value]) => {
      const current = base[key] ?? "";
      if (String(current) === String(value ?? "")) return [];
      let from = current;
      let to = value;
      if (key === "status") {
        from = STATUS_LABELS[current] || request.status || "—";
        to = STATUS_LABELS[value] || value || "—";
      } else if (key === "priority") {
        from = PRIORITY_LABELS[current] || request.priority || "—";
        to = PRIORITY_LABELS[value] || value || "—";
      } else if (key === "assigned_to") {
        from = request.assignedToName || "Non assigné";
        to = assignees.find((item) => String(item.id) === String(value))?.display_name || "Non assigné";
      } else if (key === "service") {
        from = request.service || "À trier";
        to = services.find((item) => String(item.id) === String(value))?.name || "À trier";
      } else if (key === "resolution_summary") {
        from = current || "Aucun résumé";
        to = value || "Aucun résumé";
      }
      return [{ key, label: fieldLabel(key), from, to }];
    });
  }, [assignees, form, request, services]);

  async function searchSimilarRequests() {
    if (!request || similarLoading) return;
    setSimilarLoading(true); setSimilarSearched(true); setError("");
    try { setSimilarItems(await getSimilar(request.ref)); }
    catch (e) { setSimilarItems([]); setError(getApiErrorMessage(e, "Impossible de rechercher les dossiers similaires.")); }
    finally { setSimilarLoading(false); }
  }

  async function markAsDuplicate(candidate) {
    if (!request || !candidate?.numericId || duplicateSaving) return;
    if (!window.confirm(`Marquer ${request.ref} comme doublon de ${candidate.ref} ?`)) return;
    setDuplicateSaving(true); setError(""); setNotice("");
    try {
      await linkDuplicate(request.ref, candidate.numericId);
      await load();
      setNotice(`Doublon enregistré : ${request.ref} est maintenant lié à ${candidate.ref}.`);
    } catch (e) { setError(getApiErrorMessage(e, "Impossible de marquer ce dossier comme doublon.")); }
    finally { setDuplicateSaving(false); }
  }

  async function clearDuplicateLink() {
    if (!request?.duplicateOf || duplicateSaving) return;
    setDuplicateSaving(true); setError(""); setNotice("");
    try { await unlinkDuplicate(request.ref); await load(); setNotice("Le lien de doublon a été retiré."); }
    catch (e) { setError(getApiErrorMessage(e, "Impossible de retirer le lien de doublon.")); }
    finally { setDuplicateSaving(false); }
  }

  async function saveChanges(overrides = {}) {
    if (!request || saving) return;
    const next = { ...form, ...overrides };
    if (["completed", "rejected", "action_required"].includes(next.status) && !String(next.resolution_summary || "").trim()) {
      setError("Ajoutez un résumé : il est obligatoire pour terminer, rejeter ou demander une action au citoyen.");
      summaryRef.current?.focus();
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const previousStatus = request.statusCode;
      await updateRequest(request.ref, {
        status: next.status, priority: next.priority, assigned_to: next.assigned_to,
        service: next.service, resolution_summary: next.resolution_summary,
      });
      await load();
      setNotice(next.status !== previousStatus
        ? `Changements enregistrés. Nouveau statut : ${STATUS_LABELS[next.status] || next.status}. Le backend a créé le suivi et la notification.`
        : "Changements enregistrés avec succès.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(getApiErrorMessage(e, "Impossible de mettre à jour le dossier.")); }
    finally { setSaving(false); }
  }

  async function takeOwnership() {
    const myId = user?.id || assignees.find((a) => a.email === user?.email)?.id;
    const nextAssigned = myId || form.assigned_to;
    setForm((v) => ({ ...v, status: "in_progress", assigned_to: nextAssigned }));
    await saveChanges({ status: "in_progress", assigned_to: nextAssigned });
  }

  function prepareCitizenAction() {
    setForm((v) => ({
      ...v,
      status: "action_required",
      resolution_summary: v.resolution_summary || "Merci de fournir les éléments complémentaires nécessaires au traitement de votre demande.",
    }));
    window.setTimeout(() => {
      summaryRef.current?.focus();
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  async function addTimeline() {
    if (!note.title.trim() || !note.message.trim()) { setError("Ajoutez un titre et un message à la note de suivi."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await addTimelineEvent(request.ref, note);
      setNote({ title: "Note de suivi", message: "", is_public: false });
      setNotice(note.is_public ? "Étape publique ajoutée à la timeline." : "Note interne ajoutée au dossier.");
      await load();
    } catch (e) { setError(getApiErrorMessage(e, "Impossible d’ajouter la note de suivi.")); }
    finally { setSaving(false); }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (replyDisabled) { setError("Une demande annulée ne peut plus recevoir de réponse publique."); return; }
    if (!replyMessage.trim()) { setError("Rédigez la réponse à envoyer au citoyen."); return; }
    setReplySending(true); setError(""); setNotice("");
    try {
      await sendReply(request.ref, { message: replyMessage.trim(), images: replyFiles });
      setReplyMessage(""); setReplyFiles([]);
      setNotice("Réponse envoyée au citoyen. Elle apparaît maintenant dans son dossier et sa notification a été créée par le backend.");
      await load();
    } catch (e) { setError(getApiErrorMessage(e, "Impossible d’envoyer la réponse au citoyen.")); }
    finally { setReplySending(false); }
  }

  async function uploadReportFiles() {
    if (!reportFiles.length) return;
    setSaving(true); setError("");
    try {
      await addAgentReportAttachments(request.ref, reportFiles, { isPublic: reportPublic });
      setReportFiles([]); setNotice("Photo(s) ajoutée(s) au signalement."); await load();
    } catch (e) { setError(getApiErrorMessage(e, "Impossible d’ajouter les photos.")); }
    finally { setSaving(false); }
  }

  async function acknowledgeEmergencyAlert() {
    if (!request || request.handlingRoute !== "emergency" || request.alertStatus === "acknowledged" || alertSaving) return;
    setAlertSaving(true); setError(""); setNotice("");
    try {
      await acknowledgeAlert(request.ref);
      await load();
      setNotice("Urgence F86 prise en charge. Le citoyen a été notifié par le backend.");
    } catch (e) { setError(getApiErrorMessage(e, "Impossible de confirmer la prise en charge de l’urgence.")); }
    finally { setAlertSaving(false); }
  }

  async function reopenReport() {
    const reason = window.prompt("Motif de réouverture du signalement");
    if (!reason?.trim()) return;
    setSaving(true); setError("");
    try { await reopenAgentReport(request.ref, reason.trim()); setNotice("Signalement rouvert."); await load(); }
    catch (e) { setError(getApiErrorMessage(e, "Réouverture impossible.")); }
    finally { setSaving(false); }
  }

  if (!request) return <div className="portal-layout"><Sidebar /><div className="portal-main"><PortalTopbar eyebrow={isAdmin ? "Administration" : "Dossier citoyen"} title={`Demande ${params.id}`} /><main className="portal-content">{error ? <div className="error-card">{error}</div> : <div className="loading-card">Chargement du dossier…</div>}</main></div></div>;

  const auditAction = !isAdmin ? <button className="secondary-action" onClick={() => navigate(`/agent/audit?resource_type=request&resource_id=${encodeURIComponent(request.numericId || request.ref)}`)}>Voir l’audit</button> : null;

  return <div className="portal-layout"><Sidebar /><div className="portal-main">
    <PortalTopbar eyebrow={isAdmin ? "Supervision municipale" : "Dossier citoyen"} title={`Demande ${request.ref}`} actions={auditAction} />
    <main className="portal-content agent-request-detail-v50 request-detail-v90">
      <button className="back-link" onClick={() => navigate(requestBase)}>← Retour aux demandes</button>
      {error ? <div className="error-card" role="alert">{error}</div> : null}
      {notice ? <div className="success-inline" role="status">✓ {notice}</div> : null}
      {request.duplicateOf ? <div className="duplicate-link-banner" role="status"><div><strong>↪ Dossier lié comme doublon</strong><span>{request.duplicateOfReference ? `Doublon de ${request.duplicateOfReference}` : `Demande source #${request.duplicateOf}`}</span></div><button type="button" className="secondary-action" disabled={duplicateSaving} onClick={clearDuplicateLink}>{duplicateSaving ? "Mise à jour…" : "Retirer le lien"}</button></div> : null}
      {request.handlingRoute === "emergency" ? <div className={`request-emergency-banner ${request.alertStatus === "acknowledged" ? "is-acknowledged" : ""}`} role="status"><div><span aria-hidden="true">!</span><div><strong>F86 · CIRCUIT D’URGENCE</strong><small>{request.alertStatus === "acknowledged" ? `Prise en charge${request.alertAcknowledgedByName ? ` par ${request.alertAcknowledgedByName}` : ""}${request.alertAcknowledgedAt ? ` · ${displayDate(request.alertAcknowledgedAt)}` : ""}` : `Alerte ${request.alertStatus || "active"} · intervention prioritaire requise`}</small></div></div>{request.alertStatus !== "acknowledged" ? <button type="button" disabled={alertSaving} onClick={acknowledgeEmergencyAlert}>{alertSaving ? "Prise en charge…" : "Prendre en charge maintenant"}</button> : <b>✓ Acquittée</b>}</div> : null}

      <section className={`request-operations-banner ${request.requiresAgentAction ? "is-action-required" : ""}`} aria-label="Résumé du dossier">
        <div className="request-operations-banner__main">
          <div className="request-operations-banner__eyebrow">
            <span>{request.workflowLabel || request.category || request.service}</span>
            <em>{request.requestType === "signalement" ? "Signalement" : "Demande"}</em>
          </div>

          <h2>{request.title}</h2>

          <div className="request-operations-banner__meta">
            <span>{request.citizen}</span>
            <i aria-hidden="true">•</i>
            <span>{request.citizenEmail || "sans e-mail"}</span>
            <i aria-hidden="true">•</i>
            <span>Créée {request.created}</span>
          </div>

          <div className="request-operations-banner__states">
            <span className="request-operation-chip is-status">Statut · {request.status}</span>
            <span className={`request-operation-chip is-priority priority-${request.priorityCode || "normal"}`}>Priorité · {request.priority}</span>
            {request.requiresAgentAction ? <span className="request-operation-chip is-action">Action agent requise</span> : null}
            {request.requiresCitizenAction ? <span className="request-operation-chip is-waiting">Attente du citoyen</span> : null}
            {request.needsTriage ? <span className="request-operation-chip is-routing">À router</span> : null}
          </div>
        </div>

        <aside className="request-operations-banner__summary" aria-label="Informations de prise en charge">
          <div>
            <span>Responsable</span>
            <b>{request.assignedToName || "Non assigné"}</b>
          </div>
          <div>
            <span>Service</span>
            <b>{request.service || "À trier"}</b>
          </div>
          <div>
            <span>Réponses</span>
            <b>{request.agentReplyCount || 0}</b>
          </div>
        </aside>
      </section>

      <section className="portal-grid portal-grid--detail agent-smart-grid request-detail-layout-v90">
        <article className="portal-card request-citizen-brief"><span className="section-label">Besoin exprimé</span><h3>{request.requestType === "signalement" ? "Signalement citoyen" : "Demande citoyenne"}</h3><p className="detail-copy">{request.description || "Aucune description."}</p><div className="detail-list compact-detail-list"><div><span>Type</span><b>{request.requestTypeCode || request.requestType}</b></div><div><span>Catégorie</span><b>{request.category || request.reportType || "—"}</b></div>{request.requestType === "signalement" ? <div><span>Soutiens citoyens</span><b>{request.supportCount || 0}</b></div> : null}<div><span>Service</span><b>{request.service}</b></div><div><span>Lieu</span><b>{request.location?.label || request.location || request.district || "Non précisé"}</b></div><div><span>Responsable</span><b>{request.assignedToName || "Non assigné"}</b></div><div><span>Dernière mise à jour</span><b>{request.updated}</b></div></div></article>

        <article className="portal-card request-reply-card" aria-labelledby="request-reply-title">
          <div className="request-reply-card__head"><div><span className="section-label">F84 · Communication citoyen</span><h3 id="request-reply-title">Répondre au citoyen</h3></div><span className={replies.length ? "request-reply-count" : "request-reply-count is-empty"}>{replies.length} envoyée{replies.length > 1 ? "s" : ""}</span></div>
          <p className="detail-copy">Ce canal crée une réponse publique, l’ajoute au dossier du citoyen et déclenche la notification côté backend.</p>
          {replies.length ? <div className="staff-reply-history" aria-label="Réponses déjà envoyées">{replies.slice(-3).reverse().map((reply, index) => <article key={reply.key || index}><div><strong>{reply.actorName || "Équipe municipale"}</strong><span>{displayDate(reply.createdAt || reply.at)}</span></div><p>{reply.message}</p>{reply.attachments?.length ? <small>{reply.attachments.length} pièce(s) jointe(s)</small> : null}</article>)}</div> : <div className="request-no-reply">Aucune réponse municipale n’a encore été envoyée sur cette demande.</div>}
          <form className="request-reply-form" onSubmit={submitReply}>
            <label><span>Réponse au citoyen</span><textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} maxLength="10000" placeholder="Expliquez clairement l’avancement, la décision ou les éléments attendus…" disabled={replyDisabled} /></label>
            <label className="request-reply-files"><span>Images jointes (optionnel)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setReplyFiles(Array.from(e.target.files || []))} disabled={replyDisabled} /><small>{replyFiles.length ? `${replyFiles.length} fichier(s) sélectionné(s)` : "JPEG, PNG ou WebP"}</small></label>
            {replyDisabled ? <p className="field-help field-help--important">Cette demande est annulée : le backend bloque toute nouvelle réponse publique.</p> : null}
            <button className="primary-action" type="submit" disabled={replySending || replyDisabled || !replyMessage.trim()}>{replySending ? "Envoi…" : "Envoyer la réponse"}</button>
          </form>
        </article>

        <article className="portal-card portal-card--wide request-workbench">
          <div>
            <span className="section-label">Traitement</span>
            <h3>Faire avancer le dossier</h3>
            <p className="detail-copy">Modifiez le statut, le routage, le responsable ou la priorité. Le backend reste la source de vérité et crée automatiquement le suivi associé aux changements.</p>
            <div className="request-current-state">
              <div><span>Statut actuel</span><strong>{request.status}</strong></div>
              <div><span>Après enregistrement</span><strong>{STATUS_LABELS[form.status] || form.status}</strong></div>
            </div>
          </div>

          <div className="request-workbench-controls" aria-label="Paramètres de traitement">
            <label>
              <span>Statut</span>
              <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span>Priorité</span>
              <select value={form.priority} onChange={(e) => setForm((v) => ({ ...v, priority: e.target.value }))}>
                {PRIORITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span>Responsable</span>
              <select value={form.assigned_to ?? ""} onChange={(e) => setForm((v) => ({ ...v, assigned_to: e.target.value ? Number(e.target.value) : "" }))}>
                <option value="">Non assigné</option>
                {assignees.map((a) => <option key={a.id} value={a.id}>{a.display_name} · {a.role}</option>)}
              </select>
            </label>
            <label>
              <span>Service</span>
              <select value={form.service ?? ""} onChange={(e) => setForm((v) => ({ ...v, service: e.target.value ? Number(e.target.value) : "" }))}>
                <option value="">À trier</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>

          <div className="request-workbench-grid"><label><span>Résumé / décision / information demandée</span><textarea ref={summaryRef} value={form.resolution_summary} onChange={(e) => setForm((v) => ({ ...v, resolution_summary: e.target.value }))} placeholder="Ex. Merci de fournir un justificatif de domicile..." /></label><div className="request-change-preview"><h4>Résumé des changements à enregistrer</h4>{changePreview.length ? <div className="request-change-preview__list">{changePreview.map((item) => <div key={item.key}><span>{item.label}</span><del>{item.from}</del><i aria-hidden="true">→</i><ins>{item.to}</ins></div>)}</div> : <p className="detail-copy">Aucune modification en attente.</p>}</div><div className="request-workbench-actions"><button type="button" className="secondary-action" disabled={saving} onClick={takeOwnership}>Prendre en charge</button><button type="button" className="secondary-action" disabled={saving} onClick={prepareCitizenAction}>Demander une action au citoyen</button><button type="button" className="primary-action" disabled={saving} onClick={() => saveChanges()}>{saving ? "Enregistrement…" : "Enregistrer les changements"}</button></div></div>
          {sensitiveStatus ? <p className="field-help field-help--important">Un résumé est requis pour l’état sélectionné.</p> : null}
        </article>

        {request.requestType === "signalement" ? <article className="portal-card portal-card--wide similar-requests-card">
          <div className="similar-requests-head"><div><span className="section-label">F75 · Aide au repérage</span><h3>Dossiers similaires</h3><p className="detail-copy">Le score aide à repérer les demandes proches. Aucun dossier n’est lié automatiquement : l’agent garde la décision finale.</p></div><button type="button" className="secondary-action" disabled={similarLoading} onClick={searchSimilarRequests}>{similarLoading ? "Recherche…" : similarSearched ? "Actualiser" : "Rechercher les similaires"}</button></div>
          {similarSearched ? <div className="similar-request-results">{similarItems.slice(0, 8).map((item) => <article className="similar-request-row" key={item.ref}><div className="similar-score" aria-label={`Similarité ${item.matchScoreLabel}`}><strong>{item.matchScoreLabel}</strong><span>similaire</span></div><div className="similar-request-copy"><div><strong>{item.title}</strong><span className="mono">{item.ref}</span></div><p>{item.description || "Aucune description."}</p><div className="similar-request-meta"><span>{item.status}</span><span>{item.service}</span>{item.location?.label ? <span>{item.location.label}</span> : null}{item.matchReasons?.slice(0, 3).map((reason) => <em key={reason}>{reason}</em>)}</div></div><div className="similar-request-actions"><button type="button" className="text-action" onClick={() => navigate(`${requestBase}/${encodeURIComponent(item.ref)}`)}>Ouvrir</button><button type="button" className="secondary-action" disabled={!item.numericId || duplicateSaving || String(request.duplicateOf || "") === String(item.numericId)} onClick={() => markAsDuplicate(item)}>{String(request.duplicateOf || "") === String(item.numericId) ? "Déjà lié" : "Marquer comme doublon"}</button></div></article>)}{!similarItems.length ? <div className="empty-inline">Aucun dossier similaire détecté.</div> : null}</div> : <div className="similar-request-empty"><span>◎</span><p>Lancez la recherche pour comparer ce dossier aux demandes existantes.</p></div>}
        </article> : null}

        <article className="portal-card"><span className="section-label">Historique complet</span><h3>Timeline du dossier</h3><div className="activity-feed request-timeline-v50">{history.map((item, index) => <div key={item.key || index}><i>{item.isPublic === false ? "◆" : item.eventType === "reply" ? "↩" : "●"}</i><div><b>{item.title || item.label}</b>{item.message ? <small>{item.message}</small> : null}<span>{item.actorName ? `${item.actorName} · ` : ""}{displayDate(item.createdAt || item.at)}{item.isPublic === false ? " · interne" : ""}</span></div></div>)}{!history.length ? <div className="empty-inline">Aucun événement enregistré.</div> : null}</div></article>

        <article className="portal-card request-note-card"><span className="section-label">Suivi métier</span><h3>Note interne / étape de suivi</h3><p className="detail-copy">Utilisez cette zone pour documenter le traitement. Pour écrire directement au citoyen, utilisez le canal « Répondre au citoyen » ci-dessus.</p><label><span>Titre</span><input value={note.title} onChange={(e) => setNote((v) => ({ ...v, title: e.target.value }))} /></label><label><span>Message</span><textarea value={note.message} onChange={(e) => setNote((v) => ({ ...v, message: e.target.value }))} placeholder="Information de suivi interne..." /></label><label className="audit-check"><input type="checkbox" checked={note.is_public} onChange={(e) => setNote((v) => ({ ...v, is_public: e.target.checked }))} /><span>Publier aussi dans la timeline visible par le citoyen</span></label><button type="button" className="secondary-action" disabled={saving} onClick={addTimeline}>{note.is_public ? "Publier l’étape" : "Ajouter la note interne"}</button></article>

        <article className="portal-card agent-evidence-card portal-card--wide"><span className="section-label">Éléments</span><h3>Pièces jointes et résolution</h3>{request.resolutionSummary ? <p className="resolution-box">{request.resolutionSummary}</p> : null}{request.attachments?.length ? <div className="document-grid">{request.attachments.map((file, index) => <div className="document-row document-row--download" key={file.id || file.name || index}><i>{String(file.content_type || file.type || "").includes("image") ? "IMG" : "DOC"}</i><div><b>{file.original_name || file.name || `Pièce ${index + 1}`}</b><span>{file.uploader_name || file.uploaderName || "Citoyen"}{file.isPublic === false ? " · interne" : ""}</span></div><button type="button" className="secondary-action" onClick={async () => { setError(""); try { await downloadRequestAttachment(file); } catch (e) { setError(getApiErrorMessage(e, "Téléchargement impossible.")); } }}>Télécharger</button></div>)}</div> : <span className="empty-inline">Aucun document joint.</span>}
          {request.requestType === "signalement" ? <div className="report-agent-tools"><label><span>Ajouter des photos d’intervention</span><input type="file" accept="image/*" multiple onChange={(e) => setReportFiles(Array.from(e.target.files || []))} /></label><label className="audit-check"><input type="checkbox" checked={reportPublic} onChange={(e) => setReportPublic(e.target.checked)} /><span>Visibles par le citoyen</span></label><button type="button" className="secondary-action" disabled={saving || !reportFiles.length} onClick={uploadReportFiles}>Ajouter les photos</button>{request.isClosed ? <button type="button" className="secondary-action" disabled={saving} onClick={reopenReport}>Rouvrir le signalement</button> : null}</div> : null}
        </article>
      </section>
    </main>
  </div></div>;
}
