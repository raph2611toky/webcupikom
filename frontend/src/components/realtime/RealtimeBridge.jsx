import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import {
  ensureRealtimeConnection,
  realtimeEvents,
  startRealtime,
  stopRealtime,
} from "../../realtime/realtime.js";
import { startRealtimePolling, stopRealtimePolling } from "../../realtime/pollingFallback.js";
import { navigate } from "../../utils/navigation.js";

const TOAST_DURATION = 10_000;
const SEMANTIC_DEDUPE_MS = 10_000;
const MAX_TOASTS = 3;

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function reportReference(payload = {}) {
  return text(payload.reference || payload.request_reference || payload.related_request);
}

function toastFromEvent(detail, role) {
  if (!detail || detail.type !== "event") return null;
  const event = text(detail.event);
  const payload = detail.payload || {};

  if (event === "notification.created" && payload.visible_now !== false) {
    const relatedRequest = text(payload.related_request || payload.request_reference);
    const relatedNews = text(payload.news_slug);
    return {
      key: relatedRequest ? `request:${relatedRequest}` : relatedNews ? `news:${relatedNews}` : `notification:${payload.id ?? detail.event_id}`,
      title: text(payload.title, "Nouvelle notification"),
      message: text(payload.message, "Une nouvelle information est disponible."),
      variant: payload.is_important ? "important" : "info",
      actionUrl: text(payload.action_url),
    };
  }

  if (role === "citizen" && event === "notifications.refresh") {
    return {
      key: `notifications:${payload.batch_code || detail.event_id}`,
      title: "Nouvelle notification",
      message: "Une nouvelle information municipale est disponible.",
      variant: "info",
      actionUrl: "/citizen/notifications",
    };
  }

  if ((event === "news.created" || event === "news.updated") && payload.title && payload.is_published !== false) {
    const kind = text(payload.publication_type, "news").toLowerCase();
    const created = event === "news.created";
    const title = kind === "alert"
      ? (created ? "Nouvelle alerte" : "Alerte mise à jour")
      : kind === "announcement"
        ? (created ? "Nouvelle annonce" : "Annonce mise à jour")
        : (created ? "Nouvelle actualité" : "Actualité mise à jour");
    const prefix = role === "citizen" ? "/citizen/news" : role === "admin" ? "/admin/news" : "/agent/news";
    return {
      key: `news:${payload.slug || payload.id || detail.event_id}`,
      title,
      message: text(payload.title),
      variant: kind === "alert" || payload.severity === "critical" ? "important" : "info",
      actionUrl: payload.slug ? `${prefix}/${encodeURIComponent(payload.slug)}` : "",
    };
  }

  if (role === "citizen" && (event === "request.created" || event === "request.updated")) {
    const reference = reportReference(payload);
    const isReport = text(payload.request_type).toLowerCase() === "report" || /^SIG-/i.test(reference) || payload.handling_route === "emergency";
    return {
      key: `request:${reference || detail.event_id}`,
      title: isReport
        ? (event.endsWith("created") ? "Signalement enregistré" : "Signalement mis à jour")
        : (event.endsWith("created") ? "Demande enregistrée" : "Demande mise à jour"),
      message: [reference, text(payload.status_label)].filter(Boolean).join(" · ") || "Les informations ont été actualisées.",
      variant: payload.handling_route === "emergency" ? "important" : "info",
      actionUrl: reference ? `/citizen/requests/${encodeURIComponent(reference)}` : "",
    };
  }

  if (role === "citizen") return null;

  if (event === "staff.request.created" || event === "staff.request.updated") {
    const reference = reportReference(payload);
    const isReport = text(payload.request_type).toLowerCase() === "report" || /^SIG-/i.test(reference) || payload.handling_route === "emergency";
    return {
      key: `request:${reference || detail.event_id}`,
      title: isReport ? (event.endsWith("created") ? "Nouveau signalement" : "Signalement mis à jour") : (event.endsWith("created") ? "Nouvelle demande" : "Demande mise à jour"),
      message: [reference, text(payload.status_label)].filter(Boolean).join(" · ") || "Les données ont été actualisées.",
      variant: payload.handling_route === "emergency" ? "important" : "info",
      actionUrl: reference ? `${role === "admin" ? "/admin" : "/agent"}/requests/${encodeURIComponent(reference)}` : "",
    };
  }

  if (event === "contact.assigned") {
    return {
      key: `contact:${payload.reference || detail.event_id}`,
      title: "Message assigné",
      message: [text(payload.reference), text(payload.subject)].filter(Boolean).join(" · "),
      variant: "info",
      actionUrl: payload.reference ? `${role === "admin" ? "/admin" : "/agent"}/messages/${encodeURIComponent(payload.reference)}` : "",
    };
  }

  return null;
}

function ToastIcon({ variant }) {
  return variant === "important" ? <span aria-hidden="true">!</span> : <span aria-hidden="true">i</span>;
}

export default function RealtimeBridge() {
  const { user, isAuthenticated, ready, clearSession } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [realtimeStatus, setRealtimeStatus] = useState("idle");
  const timers = useRef(new Map());
  const lastSemantic = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((rows) => rows.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    if (!toast?.title) return;
    const now = Date.now();
    const semanticKey = toast.key || `${toast.title}:${toast.message}`;
    const previous = lastSemantic.current.get(semanticKey);

    if (previous && now - previous.at < SEMANTIC_DEDUPE_MS) {
      return;
    }

    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { ...toast, id, createdAt: now };
    setToasts((rows) => [...rows.slice(-(MAX_TOASTS - 1)), item]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), TOAST_DURATION));
    lastSemantic.current.set(semanticKey, { id, at: now });
  }, [dismiss]);

  useEffect(() => {
    if (!ready || !isAuthenticated || !user) {
      stopRealtime();
      stopRealtimePolling();
      setRealtimeStatus("idle");
      return undefined;
    }

    startRealtime(user);

    const onFocus = () => ensureRealtimeConnection();
    const onVisibility = () => {
      if (document.visibilityState === "visible") ensureRealtimeConnection();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      stopRealtime();
      stopRealtimePolling();
    };
  }, [isAuthenticated, ready, user?.id, user?.pk, user?.role]);

  useEffect(() => {
    const onRealtimeEvent = (event) => {
      const toast = toastFromEvent(event.detail, user?.role);
      if (toast) pushToast(toast);
    };

    const onSessionInvalid = () => {
      stopRealtime();
      clearSession();
      navigate("/login", { replace: true });
    };

    const onRealtimeStatus = (event) => {
      setRealtimeStatus(text(event.detail?.status, "idle"));
    };

    window.addEventListener(realtimeEvents.EVENT, onRealtimeEvent);
    window.addEventListener(realtimeEvents.SESSION_INVALID_EVENT, onSessionInvalid);
    window.addEventListener(realtimeEvents.STATUS_EVENT, onRealtimeStatus);
    return () => {
      window.removeEventListener(realtimeEvents.EVENT, onRealtimeEvent);
      window.removeEventListener(realtimeEvents.SESSION_INVALID_EVENT, onSessionInvalid);
      window.removeEventListener(realtimeEvents.STATUS_EVENT, onRealtimeStatus);
    };
  }, [clearSession, pushToast, user?.role]);

  useEffect(() => {
    if (!ready || !isAuthenticated || !user) {
      stopRealtimePolling();
      return undefined;
    }

    // Le polling ne remplace jamais le socket : il sert uniquement de filet de
    // sécurité lorsque la couche temps réel signale explicitement un fallback.
    if (["http_fallback", "offline", "auth_wait"].includes(realtimeStatus)) {
      startRealtimePolling(user);
      return () => stopRealtimePolling();
    }

    if (realtimeStatus === "connected") stopRealtimePolling();
    return undefined;
  }, [isAuthenticated, ready, realtimeStatus, user?.id, user?.pk, user?.role]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="realtime-toast-stack" aria-live="assertive" aria-atomic="false">
      {toasts.map((toast) => (
        <article key={toast.id} className={`realtime-toast realtime-toast--${toast.variant || "info"}`} role="status">
          <div className="realtime-toast__icon"><ToastIcon variant={toast.variant} /></div>
          <div className="realtime-toast__content">
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
            {toast.actionUrl ? <button type="button" onClick={() => { dismiss(toast.id); navigate(toast.actionUrl); }}>Ouvrir →</button> : null}
          </div>
          <button className="realtime-toast__close" type="button" aria-label="Fermer la notification" onClick={() => dismiss(toast.id)}>×</button>
          <i className="realtime-toast__timer" aria-hidden="true" />
        </article>
      ))}
    </div>
  );
}
