import { api } from "../api/api.js";
import { invalidateCache } from "../api/cache.js";
import { env } from "../config/env.js";

const BASE_RECONNECT_DELAYS = [1500, 3000, 6000, 12000, 20000, 30000];
const HEARTBEAT_MS = 25_000;
const AVAILABILITY_RECHECK_MS = 60_000;
const START_DEBOUNCE_MS = 180;
const EVENT = "nova-realtime-event";
const STATE_EVENT = "nova-realtime-state";
const STATUS_EVENT = "nova-realtime-status";
const SESSION_INVALID_EVENT = "nova-realtime-session-invalid";

let wanted = false;
let socket = null;
let startTimer = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let connectPromise = null;
let statusPromise = null;
let generation = 0;
let reconnectAttempt = 0;
let currentIdentityKey = "";
let lastStatus = "idle";
let availabilityKnown = false;
let realtimeAvailable = false;
let nextAvailabilityProbeAt = 0;

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function setStatus(status, extra = {}) {
  if (lastStatus === status && !Object.keys(extra).length) return;
  lastStatus = status;
  emit(STATUS_EVENT, { status, ...extra });
}

function clearTimeoutRef(ref) {
  if (ref) window.clearTimeout(ref);
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function closeSocket(code = 1000, reason = "client_stop") {
  clearHeartbeat();
  if (!socket) return;
  const current = socket;
  socket = null;
  current.onopen = null;
  current.onmessage = null;
  current.onerror = null;
  current.onclose = null;
  try {
    if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
      current.close(code, reason);
    }
  } catch {
    // Le temps réel reste strictement optionnel.
  }
}

function backendOrigin() {
  try {
    return new URL(env.apiBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function websocketUrl(path) {
  const url = new URL(path, backendOrigin());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function eventDomain(eventName = "", payload = {}) {
  if (eventName.startsWith("notification.")) return "notification";
  if (eventName === "news.refresh" || eventName.startsWith("news.")) return "news";
  if (eventName.startsWith("staff.request.") || eventName.startsWith("request.")) {
    const requestType = String(payload.request_type || "").toLowerCase();
    const reference = String(payload.reference || payload.request_reference || "");
    if (requestType === "report" || /^SIG-/i.test(reference) || payload.handling_route === "emergency") return "report";
    return "request";
  }
  if (eventName.startsWith("appointment.")) return "appointment";
  if (eventName.startsWith("service.")) return "service";
  if (eventName.startsWith("contact.")) return "message";
  if (eventName.startsWith("audit.")) return "audit";
  if (eventName.startsWith("webcup.")) return "webcup";
  if (eventName.startsWith("security.")) return "security";
  return "other";
}

function fanOutRealtimeEvent(message) {
  const eventName = String(message?.event || "");
  const payload = message?.payload || {};
  const domain = eventDomain(eventName, payload);

  emit(EVENT, { ...message, domain });
  emit(`nova-realtime:${domain}`, { ...message, domain });

  if (domain === "notification") {
    emit("nova-notifications-updated", { source: "realtime", event: eventName, payload });
  }

  if (domain === "news") {
    invalidateCache("news:");
    invalidateCache("alerts:");
    emit("terra-news-updated", { source: "realtime", event: eventName, payload });
  }

  if (domain === "report") {
    emit("nova-reports-updated", { source: "realtime", event: eventName, payload });
    emit("nova-requests-updated", { source: "realtime", event: eventName, payload });
  } else if (domain === "request") {
    emit("nova-requests-updated", { source: "realtime", event: eventName, payload });
  }

  if (domain === "appointment") emit("nova-appointments-updated", { source: "realtime", event: eventName, payload });
  if (domain === "service") {
    invalidateCache("services:");
    emit("nova-services-updated", { source: "realtime", event: eventName, payload });
  }
  if (domain === "message") emit("nova-messages-updated", { source: "realtime", event: eventName, payload });
  if (domain === "audit") emit("nova-audit-updated", { source: "realtime", event: eventName, payload });
  if (domain === "webcup") emit("nova-webcup-updated", { source: "realtime", event: eventName, payload });

  if (domain === "security" && (
    payload?.reauthentication_required ||
    ["security.session_revoked", "security.sessions_revoked", "security.account_disabled", "security.permissions_changed"].includes(eventName)
  )) {
    emit(SESSION_INVALID_EVENT, { source: "realtime", event: eventName, payload });
  }
}

function handleMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  if (!message || typeof message !== "object") return;

  if (message.type === "connection.ready") {
    setStatus("connected", {
      role: message.role,
      source_of_truth: message.source_of_truth || "http",
      delivery: message.delivery || "best_effort",
    });
    return;
  }

  if (message.type === "state.snapshot") {
    emit(STATE_EVENT, message);
    return;
  }

  if (message.type === "security.session_invalid") {
    emit(SESSION_INVALID_EVENT, message);
    return;
  }

  if (message.type === "event") fanOutRealtimeEvent(message);
}

function scheduleReconnect(localGeneration, minimumDelay = 0, { availabilityProbe = false } = {}) {
  if (!wanted || localGeneration !== generation || reconnectTimer) return;
  const base = availabilityProbe
    ? AVAILABILITY_RECHECK_MS
    : BASE_RECONNECT_DELAYS[Math.min(reconnectAttempt, BASE_RECONNECT_DELAYS.length - 1)];
  const delay = Math.max(minimumDelay, base);
  if (!availabilityProbe) reconnectAttempt += 1;

  setStatus(availabilityProbe ? "http_fallback" : "reconnecting", {
    retry_in_ms: delay,
    http_fallback: availabilityProbe,
  });

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect(localGeneration, { forceAvailabilityProbe: availabilityProbe });
  }, delay);
}

async function checkRealtimeAvailability({ force = false } = {}) {
  const now = Date.now();
  if (!force && availabilityKnown && now < nextAvailabilityProbeAt) {
    return realtimeAvailable;
  }
  if (statusPromise) return statusPromise;

  statusPromise = api.get("/realtime/status/")
    .then(({ data }) => {
      availabilityKnown = true;
      realtimeAvailable = Boolean(data?.enabled && data?.available);
      nextAvailabilityProbeAt = realtimeAvailable ? now + 10_000 : now + AVAILABILITY_RECHECK_MS;
      return realtimeAvailable;
    })
    .catch(() => {
      // Une panne de la couche optionnelle ne doit jamais polluer ni bloquer l'application métier.
      availabilityKnown = true;
      realtimeAvailable = false;
      nextAvailabilityProbeAt = Date.now() + AVAILABILITY_RECHECK_MS;
      return false;
    })
    .finally(() => {
      statusPromise = null;
    });

  return statusPromise;
}

async function requestTicket() {
  const { data } = await api.post("/realtime/ticket/", {});
  if (!data?.ticket || !data?.websocket_path) {
    throw new Error("Le backend n'a pas retourné de ticket WebSocket utilisable.");
  }
  return data;
}

async function connect(localGeneration = generation, { forceAvailabilityProbe = false } = {}) {
  if (!wanted || localGeneration !== generation) return;
  if (reconnectTimer) return;
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  if (connectPromise) return connectPromise;

  setStatus("checking");

  connectPromise = (async () => {
    try {
      const available = await checkRealtimeAvailability({ force: forceAvailabilityProbe });
      if (!wanted || localGeneration !== generation) return;

      if (!available) {
        setStatus("http_fallback", { http_fallback: true });
        scheduleReconnect(localGeneration, AVAILABILITY_RECHECK_MS, { availabilityProbe: true });
        return;
      }

      setStatus("connecting");
      const ticket = await requestTicket();
      if (!wanted || localGeneration !== generation) return;

      const ws = new WebSocket(websocketUrl(ticket.websocket_path));
      socket = ws;

      ws.onopen = () => {
        if (socket !== ws || !wanted || localGeneration !== generation) return;
        reconnectAttempt = 0;
        realtimeAvailable = true;
        availabilityKnown = true;
        nextAvailabilityProbeAt = Date.now() + 10_000;
        clearHeartbeat();
        heartbeatTimer = window.setInterval(() => {
          if (socket === ws && ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* best effort */ }
          }
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (event) => {
        if (socket !== ws || !wanted || localGeneration !== generation) return;
        handleMessage(event.data);
      };

      ws.onerror = () => {
        // onclose décide du retry ; aucune erreur ne remonte dans les écrans métier.
      };

      ws.onclose = (event) => {
        if (socket === ws) socket = null;
        clearHeartbeat();
        if (!wanted || localGeneration !== generation) return;

        if (event.code === 1000) return;
        if (event.code === 4401) {
          scheduleReconnect(localGeneration, 1000);
          return;
        }
        if (event.code === 1013) {
          availabilityKnown = false;
          nextAvailabilityProbeAt = 0;
          scheduleReconnect(localGeneration, AVAILABILITY_RECHECK_MS, { availabilityProbe: true });
          return;
        }
        scheduleReconnect(localGeneration);
      };
    } catch (error) {
      if (!wanted || localGeneration !== generation) return;
      const status = Number(error?.response?.status || 0);

      if (status === 401 || status === 403) {
        setStatus("auth_wait");
        scheduleReconnect(localGeneration, 15_000);
      } else if (status === 503) {
        // Course possible : status était UP puis Redis tombe avant le ticket.
        // On repasse immédiatement en HTTP et on ne redemande plus de ticket avant le prochain probe.
        availabilityKnown = true;
        realtimeAvailable = false;
        nextAvailabilityProbeAt = Date.now() + AVAILABILITY_RECHECK_MS;
        setStatus("http_fallback", { http_fallback: true });
        scheduleReconnect(localGeneration, AVAILABILITY_RECHECK_MS, { availabilityProbe: true });
      } else {
        setStatus("offline", { http_fallback: true });
        scheduleReconnect(localGeneration, 30_000);
      }
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

function scheduleInitialConnect(localGeneration) {
  clearTimeoutRef(startTimer);
  startTimer = window.setTimeout(() => {
    startTimer = null;
    if (!wanted || localGeneration !== generation) return;
    connect(localGeneration);
  }, START_DEBOUNCE_MS);
}

export function startRealtime(identity = {}) {
  const identityKey = `${identity?.id ?? identity?.pk ?? ""}:${identity?.role ?? ""}`;
  const identityChanged = identityKey && identityKey !== currentIdentityKey;
  currentIdentityKey = identityKey;
  wanted = true;

  if (identityChanged) {
    generation += 1;
    reconnectAttempt = 0;
    clearTimeoutRef(startTimer);
    startTimer = null;
    clearTimeoutRef(reconnectTimer);
    reconnectTimer = null;
    closeSocket(1000, "identity_changed");
    availabilityKnown = false;
    realtimeAvailable = false;
    nextAvailabilityProbeAt = 0;
  }

  scheduleInitialConnect(generation);
}

export function stopRealtime() {
  wanted = false;
  generation += 1;
  currentIdentityKey = "";
  reconnectAttempt = 0;
  clearTimeoutRef(startTimer);
  startTimer = null;
  clearTimeoutRef(reconnectTimer);
  reconnectTimer = null;
  connectPromise = null;
  closeSocket(1000, "client_stop");
  setStatus("idle");
}

export function ensureRealtimeConnection() {
  if (!wanted || reconnectTimer || startTimer || connectPromise) return;
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  if (availabilityKnown && !realtimeAvailable && Date.now() < nextAvailabilityProbeAt) return;
  connect(generation, { forceAvailabilityProbe: true });
}

export function sendRealtimeMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

export function syncRealtimeState() {
  return sendRealtimeMessage({ type: "sync" });
}

export function subscribeRealtimeResource(resource, id) {
  return sendRealtimeMessage({ type: "subscribe", resource, id: String(id) });
}

export function unsubscribeRealtimeResource(resource, id) {
  return sendRealtimeMessage({ type: "unsubscribe", resource, id: String(id) });
}

export const realtimeEvents = Object.freeze({
  EVENT,
  STATE_EVENT,
  STATUS_EVENT,
  SESSION_INVALID_EVENT,
});
