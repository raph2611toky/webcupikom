import { getCitizenNotifications } from "../api/notifications.js";
import { getNews } from "../api/news.js";
import {
  getAdminRequests,
  getAgentRequests,
  getCitizenRequests,
} from "../api/requests.js";
import { dispatchRealtimeEvent } from "./realtime.js";

const POLL_INTERVAL_MS = 12_000;
const MAX_TRACKED = 80;

let timer = null;
let running = false;
let generation = 0;
let currentIdentityKey = "";
let baselineReady = false;
let notificationSeen = new Set();
let newsSeen = new Map();
let requestSeen = new Map();

function text(value) {
  return String(value ?? "").trim();
}

function resetSnapshots() {
  baselineReady = false;
  notificationSeen = new Set();
  newsSeen = new Map();
  requestSeen = new Map();
}

function trimSet(set) {
  if (set.size <= MAX_TRACKED) return set;
  return new Set([...set].slice(-MAX_TRACKED));
}

function trimMap(map) {
  if (map.size <= MAX_TRACKED) return map;
  return new Map([...map].slice(-MAX_TRACKED));
}

function newsKey(item = {}) {
  return text(item.slug || item.id);
}

function newsFingerprint(item = {}) {
  return [
    text(item.updated_at || item.updatedAt),
    text(item.published_at || item.publishedAt),
    text(item.title),
    text(item.publication_type || item.publicationType),
    text(item.severity),
    String(item.is_published ?? item.published ?? true),
  ].join("|");
}

function requestKey(item = {}) {
  return text(item.reference || item.ref || item.id);
}

function requestFingerprint(item = {}) {
  return [
    text(item.updated_at || item.updatedAt),
    text(item.statusCode || item.status),
    text(item.alertStatus || item.alert_status),
    text(item.assigned_to_id || item.assignedToId),
  ].join("|");
}

async function loadRequests(role) {
  const params = { ordering: "-updated_at", page_size: 30 };
  if (role === "admin") return getAdminRequests(params);
  if (role === "agent") return getAgentRequests(params);
  if (role === "citizen") return getCitizenRequests(params);
  return [];
}

function emitNews(item, created) {
  const publicationType = text(item.publication_type || item.publicationType || "news").toLowerCase();
  dispatchRealtimeEvent(created ? "news.created" : "news.updated", {
    id: item.id,
    slug: item.slug,
    title: item.title,
    publication_type: publicationType,
    severity: item.severity || "info",
    is_published: item.is_published ?? item.published ?? true,
    published_at: item.published_at || item.publishedAt,
    source: "http_polling",
  }, { source: "http_polling" });
}

function emitRequest(item, created, role) {
  const requestType = text(item.requestTypeCode || item.request_type || item.requestType).toLowerCase();
  const payload = {
    reference: item.reference || item.ref || item.id,
    request_type: requestType === "signalement" ? "report" : requestType,
    status: item.statusCode || item.status,
    status_label: item.status,
    handling_route: item.handlingRoute || item.handling_route,
    alert_status: item.alertStatus || item.alert_status,
    updated_at: item.updated_at || item.updatedAt,
    source: "http_polling",
  };
  dispatchRealtimeEvent(
    role === "citizen"
      ? (created ? "request.created" : "request.updated")
      : (created ? "staff.request.created" : "staff.request.updated"),
    payload,
    { source: "http_polling" },
  );
}

async function poll(identity, localGeneration) {
  if (!running || localGeneration !== generation) return;
  const role = text(identity?.role).toLowerCase();

  const tasks = [
    getNews({ publishedOnly: true, force: true }).then((rows) => ({ kind: "news", rows })).catch(() => ({ kind: "news", rows: null })),
    loadRequests(role).then((rows) => ({ kind: "requests", rows })).catch(() => ({ kind: "requests", rows: null })),
  ];

  if (role === "citizen") {
    tasks.push(
      getCitizenNotifications({ page_size: 40 })
        .then((rows) => ({ kind: "notifications", rows }))
        .catch(() => ({ kind: "notifications", rows: null })),
    );
  }

  const results = await Promise.all(tasks);
  if (!running || localGeneration !== generation) return;

  for (const result of results) {
    if (!Array.isArray(result.rows)) continue;

    if (result.kind === "notifications") {
      const next = new Set(result.rows.map((item) => String(item.id)).filter(Boolean));
      if (baselineReady) {
        for (const item of result.rows) {
          const id = String(item.id ?? "");
          if (!id || notificationSeen.has(id)) continue;
          dispatchRealtimeEvent("notification.created", {
            ...item,
            visible_now: true,
            is_important: Boolean(item.is_important ?? item.important),
            related_request: item.request_reference || item.related_request,
            news_slug: item.news_slug || item.related_news?.slug,
            source: "http_polling",
          }, { source: "http_polling" });
        }
      }
      notificationSeen = trimSet(next);
      continue;
    }

    if (result.kind === "news") {
      const next = new Map();
      for (const item of result.rows) {
        const key = newsKey(item);
        if (!key) continue;
        const fingerprint = newsFingerprint(item);
        next.set(key, fingerprint);
        if (!baselineReady) continue;
        const previous = newsSeen.get(key);
        if (previous === undefined) emitNews(item, true);
        else if (previous !== fingerprint) emitNews(item, false);
      }
      newsSeen = trimMap(next);
      continue;
    }

    if (result.kind === "requests") {
      const next = new Map();
      for (const item of result.rows) {
        const key = requestKey(item);
        if (!key) continue;
        const fingerprint = requestFingerprint(item);
        next.set(key, fingerprint);
        if (!baselineReady) continue;
        const previous = requestSeen.get(key);
        if (previous === undefined) emitRequest(item, true, role);
        else if (previous !== fingerprint) emitRequest(item, false, role);
      }
      requestSeen = trimMap(next);
    }
  }

  baselineReady = true;
}

function schedule(identity, localGeneration, immediate = false) {
  if (!running || localGeneration !== generation) return;
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    timer = null;
    await poll(identity, localGeneration);
    schedule(identity, localGeneration, false);
  }, immediate ? 1200 : POLL_INTERVAL_MS);
}

export function startRealtimePolling(identity = {}) {
  const identityKey = `${identity?.id ?? identity?.pk ?? ""}:${identity?.role ?? ""}`;
  if (running && identityKey === currentIdentityKey) return;

  stopRealtimePolling();
  currentIdentityKey = identityKey;
  running = true;
  generation += 1;
  resetSnapshots();
  schedule(identity, generation, true);
}

export function stopRealtimePolling() {
  running = false;
  generation += 1;
  currentIdentityKey = "";
  if (timer) window.clearTimeout(timer);
  timer = null;
  resetSnapshots();
}
