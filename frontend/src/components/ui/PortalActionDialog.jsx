import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export default function PortalActionDialog({
  open,
  eyebrow = "Confirmation",
  title,
  description = "",
  icon = "!",
  tone = "default",
  details = [],
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose?.();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  function submit(event) {
    event.preventDefault();
    if (busy || confirmDisabled) return;
    onConfirm?.(event);
  }

  return createPortal(
    <div
      className="portal-action-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <form
        className={`portal-action-dialog tone-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="portal-action-dialog__topline" aria-hidden="true" />

        <header className="portal-action-dialog__header">
          <div className="portal-action-dialog__icon" aria-hidden="true">{icon}</div>
          <div>
            <span className="section-label">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
        </header>

        {details?.length ? (
          <div className="portal-action-dialog__facts">
            {details.filter((item) => item?.value !== undefined && item?.value !== null && item?.value !== "").map((item) => (
              <div key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        ) : null}

        {children ? <div className="portal-action-dialog__content">{children}</div> : null}

        <footer className="portal-action-dialog__actions">
          <button type="button" className="secondary-action" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={tone === "danger" ? "portal-action-dialog__danger" : "primary-action"}
            disabled={busy || confirmDisabled}
          >
            {busy ? "Enregistrement…" : confirmLabel}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
