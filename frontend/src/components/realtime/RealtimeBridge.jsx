import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import {
  ensureRealtimeConnection,
  realtimeEvents,
  startRealtime,
  stopRealtime,
} from "../../realtime/realtime.js";
import { navigate } from "../../utils/navigation.js";

const TOAST_DURATION = 10_000;
const SEMANTIC_DEDUPE_MS = 2500;
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
    const relatedRequest = text(payload.related_request);
    const relatedNews = text(payload.news_slug);
    return {
      key: relatedRequest ? `request:${relatedRequest}` : relatedNews ? `news:${relatedNews}` : `notification:${payload.id ?? detail.event_id}`,
      title: text(payload.title, "Nouvelle notification"),
      message: text(payload.message, "Une nouvelle information est disponible."),
      variant: payload.is_important ? "important" : "info",
      actionUrl: text(payload.action_url),
    };
  }

  if (role === "citizen") {
    // Les citoyens reçoivent normalement une CitizenNotification plus riche.
    // On garde donc les événements métier silencieux pour éviter les doubles toasts.
    return null;
  }

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

  if ((event === "news.created" || event === "news.updated") && payload.title) {
    return {
      key: `news:${payload.slug || payload.id || detail.event_id}`,
      title: event === "news.created" ? "Nouvelle publication" : "Publication mise à jour",
      message: text(payload.title),
      variant: payload.severity === "critical" ? "important" : "info",
      actionUrl: payload.slug ? `${role === "admin" ? "/admin/news" : "/agent/news"}/${encodeURIComponent(payload.slug)}` : "",
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
      const id = previous.id;
      setToasts((rows) => rows.map((item) => item.id === id ? { ...item, ...toast, id, createdAt: now } : item));
      const oldTimer = timers.current.get(id);
      if (oldTimer) window.clearTimeout(oldTimer);
      timers.current.set(id, window.setTimeout(() => dismiss(id), TOAST_DURATION));
      lastSemantic.current.set(semanticKey, { id, at: now });
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

    window.addEventListener(realtimeEvents.EVENT, onRealtimeEvent);
    window.addEventListener(realtimeEvents.SESSION_INVALID_EVENT, onSessionInvalid);
    return () => {
      window.removeEventListener(realtimeEvents.EVENT, onRealtimeEvent);
      window.removeEventListener(realtimeEvents.SESSION_INVALID_EVENT, onSessionInvalid);
    };
  }, [clearSession, pushToast, user?.role]);

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
