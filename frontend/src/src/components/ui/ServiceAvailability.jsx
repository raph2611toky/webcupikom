import "../../styles/service-availability.css";

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", " ·");
}

export function ServiceAvailabilityBadge({ service, compact = false }) {
  const available = service?.isAvailable !== false;
  return <span className={`service-availability-badge ${available ? "is-available" : "is-unavailable"} ${compact ? "is-compact" : ""}`.trim()}>
    <i aria-hidden="true" />
    <span>{available ? "Disponible" : "Indisponible"}</span>
  </span>;
}

export function ServiceAvailabilityNotice({ service, compact = false, showAvailable = true }) {
  if (!service) return null;
  const available = service.isAvailable !== false;
  if (available && !showAvailable) return null;

  return <section className={`service-availability-notice ${available ? "is-available" : "is-unavailable"} ${compact ? "is-compact" : ""}`.trim()} aria-live="polite">
    <div className="service-availability-notice__icon" aria-hidden="true">{available ? "✓" : "!"}</div>
    <div className="service-availability-notice__copy">
      <div className="service-availability-notice__head">
        <strong>{available ? "Service disponible" : "Service temporairement indisponible"}</strong>
        {service.availabilityUpdatedAt ? <small>Mis à jour {dateLabel(service.availabilityUpdatedAt)}</small> : null}
      </div>
      {available ? <p>Vous pouvez consulter les informations du service et commencer une démarche.</p> : <>
        <p>{service.unavailabilityReason || "Une interruption de ce service est actuellement connue par la ville."}</p>
        <div className="service-availability-notice__next">
          {service.expectedRestoreAt ? <div><span>Retour estimé</span><b>{dateLabel(service.expectedRestoreAt)}</b></div> : null}
          {service.alternativeAction ? <div><span>Que faire à la place ?</span><b>{service.alternativeAction}</b></div> : null}
        </div>
      </>}
    </div>
  </section>;
}

export function formatServiceRestoreDate(value) {
  return dateLabel(value);
}
