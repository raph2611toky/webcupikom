import { useEffect, useMemo, useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import {
  cancelCitizenAppointment,
  getAppointmentStatusLabel,
  getCitizenAppointment,
  updateCitizenAppointment,
} from "../../api/appointments.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";
import "../../styles/pages/citizen-appointments-flow.css";

function formatDateTime(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "mg" ? "mg-MG" : "fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export default function CitizenAppointmentDetails({ params }) {
  const [locale] = useLocale();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(60);

  async function load() {
    try {
      const next = await getCitizenAppointment(params.reference);
      setItem(next);
      setReminderEnabled(next.reminderEnabled);
      setReminderMinutes(next.reminderMinutesBefore || 60);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de charger ce rendez-vous."));
    }
  }

  useEffect(() => { load(); }, [params.reference]);

  const status = useMemo(() => item ? getAppointmentStatusLabel(item.status) : "", [item]);

  async function saveReminder(event) {
    event.preventDefault();
    if (!item) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const updated = await updateCitizenAppointment(item.reference, {
        reminder_enabled: reminderEnabled,
        reminder_minutes_before: reminderMinutes,
      });
      setItem(updated);
      setNotice(reminderEnabled ? "Rappel mis à jour." : "Rappel désactivé.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de modifier le rappel."));
    } finally { setSaving(false); }
  }

  async function cancel() {
    if (!item?.canCancel || !window.confirm("Annuler ce rendez-vous ?")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await cancelCitizenAppointment(item.reference);
      setNotice("Rendez-vous annulé.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible d’annuler le rendez-vous."));
    } finally { setSaving(false); }
  }

  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main">
    <PortalTopbar eyebrow="Rendez-vous" title={item?.reference || params.reference}/>
    <main className="portal-content appointment-detail-page">
      <button className="back-link" type="button" onClick={() => navigate("/citizen/appointments")}>← Retour aux rendez-vous</button>
      {error ? <div className="error-card" role="alert">{error}</div> : null}
      {notice ? <div className="success-inline" role="status">{notice}</div> : null}
      {!item ? <section className="portal-card">Chargement…</section> : <>
        <section className="appointment-detail-hero">
          <div>
            <span className="section-label">{item.serviceName}</span>
            <h2>{item.reason || "Rendez-vous citoyen"}</h2>
            <p>{formatDateTime(item.startsAt, locale)} · {item.agentName}</p>
          </div>
          <span className={`status-pill status-${item.status}`}>{status}</span>
        </section>

        <section className="appointment-detail-grid">
          <article className="portal-card">
            <span className="section-label">Informations</span>
            <h3>Votre rendez-vous</h3>
            <div className="appointment-detail-list">
              <div><span>Service</span><b>{item.serviceName}</b></div>
              <div><span>Agent</span><b>{item.agentName}</b></div>
              <div><span>Date et heure</span><b>{formatDateTime(item.startsAt, locale)}</b></div>
              <div><span>Fin prévue</span><b>{formatDateTime(item.endsAt, locale)}</b></div>
              <div><span>Lieu</span><b>{item.location || "Sera précisé lors de la confirmation"}</b></div>
              <div><span>Statut</span><b>{status}</b></div>
            </div>
          </article>

          <article className="portal-card">
            <span className="section-label">Préparation</span>
            <h3>Avant de venir</h3>
            <p className="detail-copy">{item.preparationInstructions || item.preparation || "Aucune instruction particulière n’a encore été communiquée."}</p>
            {item.preparationDocuments ? <div className="appointment-preparation-docs"><b>Documents</b><p>{item.preparationDocuments}</p></div> : null}
            {item.details ? <div className="appointment-preparation-docs"><b>Informations transmises</b><p>{item.details}</p></div> : null}
          </article>

          <form className="portal-card appointment-reminder-card" onSubmit={saveReminder}>
            <span className="section-label">Rappel</span>
            <h3>Me rappeler ce rendez-vous</h3>
            <label className="appointment-reminder-detail-toggle"><input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)}/><span>Activer le rappel</span></label>
            {reminderEnabled ? <label><span>Délai avant le rendez-vous</span><select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))}><option value={30}>30 minutes</option><option value={60}>1 heure</option><option value={120}>2 heures</option></select></label> : null}
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le rappel"}</button>
          </form>

          <article className="portal-card appointment-reference-card">
            <span className="section-label">Suivi</span>
            <h3>{item.reference}</h3>
            <p className="detail-copy">Conservez cette référence pour identifier le rendez-vous.</p>
            <div className="appointment-detail-actions">
              <button className="secondary-action" type="button" onClick={() => navigate("/citizen/appointments")}>Voir tous mes rendez-vous</button>
              {item.canCancel ? <button className="text-danger" type="button" disabled={saving} onClick={cancel}>Annuler le rendez-vous</button> : null}
            </div>
          </article>
        </section>
      </>}
    </main>
  </div></div>;
}
