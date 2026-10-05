import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

function canonicalCategory(value = "") {
  const text = String(value).trim().toLowerCase();
  if (!text) return "";
  if (
    text.includes("sécur") ||
    text.includes("secur") ||
    text.includes("session") ||
    text.includes("connexion") ||
    text.includes("login") ||
    text.includes("appareil") ||
    text.includes("device")
  ) return "Sécurité";
  if (text.includes("rendez") || text.includes("appointment")) return "Rendez-vous";
  if (text.includes("signal") || text.includes("incident") || text.includes("report")) return "Signalement";
  if (text.includes("service")) return "Service";
  if (text.includes("démarche") || text.includes("demarche") || text.includes("request")) return "Démarche";
  if (text.includes("message") || text.includes("contact")) return "Message";
  if (text.includes("info") || text.includes("news") || text.includes("actualité")) return "Information";
  return String(value);
}

function inferCategory(item = {}) {
  const direct = item.category || item.notification_category || item.kind || "";
  if (direct) return canonicalCategory(direct);

  const text = [
    item.type,
    item.notification_type,
    item.title,
    item.message,
    item.body,
    item.event,
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    text.includes("sécur") ||
    text.includes("secur") ||
    text.includes("session") ||
    text.includes("connexion") ||
    text.includes("login") ||
    text.includes("appareil") ||
    text.includes("device")
  ) return "Sécurité";
  if (text.includes("rendez") || text.includes("appointment")) return "Rendez-vous";
  if (text.includes("signal") || text.includes("incident")) return "Signalement";
  if (text.includes("service")) return "Service";
  if (text.includes("démarche") || text.includes("demarche") || text.includes("request")) return "Démarche";
  if (text.includes("message") || text.includes("contact")) return "Message";
  return "Information";
}

function inferEventStatus(item = {}) {
  return (
    item.event_status ||
    item.status_label ||
    item.request_status ||
    item.appointment_status ||
    item.status ||
    ""
  );
}

function requestReferenceFromNotification(item = {}) {
  if (item.request_reference || item.request_ref) return item.request_reference || item.request_ref;
  const actionUrl = String(item.action_url || item.actionUrl || "");
  const match = actionUrl.match(/\/(?:citizen\/)?requests\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}


function nestedObject(item = {}, key) {
  const value = item?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sessionSecurityFields(item = {}) {
  const details = nestedObject(item, "details");
  const metadata = nestedObject(item, "metadata");
  const payload = nestedObject(item, "payload");
  const data = nestedObject(item, "data");
  const securityEvent = nestedObject(item, "security_event");

  const sessionId =
    item.session_id ||
    item.sessionId ||
    details.session_id ||
    details.sessionId ||
    metadata.session_id ||
    metadata.sessionId ||
    payload.session_id ||
    payload.sessionId ||
    data.session_id ||
    data.sessionId ||
    securityEvent.session_id ||
    securityEvent.sessionId ||
    "";

  const securityEventId =
    item.security_event_id ||
    item.securityEventId ||
    details.security_event_id ||
    metadata.security_event_id ||
    payload.security_event_id ||
    data.security_event_id ||
    securityEvent.id ||
    "";

  const securityKind =
    item.security_kind ||
    item.securityKind ||
    item.kind ||
    item.event ||
    details.kind ||
    metadata.kind ||
    payload.kind ||
    data.kind ||
    securityEvent.kind ||
    "";

  const deviceLabel =
    item.device_label ||
    details.device_label ||
    details.device ||
    metadata.device_label ||
    payload.device_label ||
    data.device_label ||
    securityEvent.device_label ||
    "";

  const ipAddress =
    item.ip_address ||
    details.ip_address ||
    details.ip ||
    metadata.ip_address ||
    payload.ip_address ||
    data.ip_address ||
    securityEvent.ip_address ||
    "";

  return {
    sessionId: String(sessionId || ""),
    securityEventId: securityEventId === undefined || securityEventId === null ? "" : String(securityEventId),
    securityKind: String(securityKind || ""),
    deviceLabel: String(deviceLabel || ""),
    ipAddress: String(ipAddress || ""),
  };
}

function isSessionSecurityNotification(item = {}, fields = sessionSecurityFields(item)) {
  const haystack = [
    fields.securityKind,
    item.category,
    item.notification_category,
    item.notification_type,
    item.type,
    item.title,
    item.message,
    item.body,
  ].filter(Boolean).join(" ").toLowerCase();

  const securityWords =
    /session|connexion|login|appareil|device|nouvel appareil|new device|sécur|secur|révoqu|revoqu/;

  return Boolean(fields.sessionId || fields.securityEventId || securityWords.test(haystack));
}

export function normalizeNotification(item = {}) {
  const id = item.id ?? item.uuid ?? item.pk ?? item.notification_id;
  const createdAt = item.created_at || item.created || item.timestamp || item.date || "";
  const requestReference = requestReferenceFromNotification(item);
  const security = sessionSecurityFields(item);
  const sessionSecurity = isSessionSecurityNotification(item, security);
  const category = sessionSecurity
    ? "Sécurité"
    : requestReference && /^SIG-/i.test(String(requestReference))
      ? "Signalement"
      : inferCategory(item);
  return {
    ...item,
    id,
    title: item.title || item.subject || "Notification",
    message: item.message || item.body || item.description || "",
    is_read: Boolean(item.is_read ?? item.read ?? false),
    created_at: createdAt,
    createdLabel: item.createdLabel || formatDateTime(createdAt),
    category,
    event_status: inferEventStatus(item),
    request_reference: requestReference,
    action_url: item.action_url || item.actionUrl || "",
    action_label: item.action_label || item.actionLabel || "",
    appointment_id: item.appointment_id || item.appointment || null,
    contact_reference: item.contact_reference || item.contact_ref || null,
    service_slug: item.service_slug || item.service?.slug || null,
    session_id: security.sessionId || null,
    security_event_id: security.securityEventId || null,
    security_kind: security.securityKind || "",
    security_device_label: security.deviceLabel || "",
    security_ip_address: security.ipAddress || "",
    is_session_security: sessionSecurity,
  };
}

export async function getCitizenNotifications(params = {}) {
  const { data } = await api.get("/citizen/notifications/", { params });
  return unwrapList(data).map(normalizeNotification);
}

export async function getAllCitizenNotifications(params = {}) {
  const rows = [];
  let page = 1;
  for (let guard = 0; guard < 100; guard += 1) {
    const { data } = await api.get("/citizen/notifications/", { params: { ...params, page, page_size: params.page_size || 100 } });
    rows.push(...unwrapList(data).map(normalizeNotification));
    if (!data?.next || !Array.isArray(data?.results)) break;
    page += 1;
  }
  return rows;
}

export async function getCitizenNotification(id) {
  const { data } = await api.get(`/citizen/notifications/${encodeURIComponent(id)}/`);
  return normalizeNotification(data);
}

export async function setNotificationRead(id, isRead = true) {
  const form = new FormData();
  form.append("is_read", String(Boolean(isRead)));
  const { data } = await api.patch(
    `/citizen/notifications/${encodeURIComponent(id)}/`,
    form,
  );
  return normalizeNotification(data);
}

export async function markAllNotificationsRead() {
  const { data } = await api.post("/citizen/notifications/read-all/");
  return data;
}

export async function sendAgentNotification(payload = {}) {
  const form = new FormData();
  const values = {
    audience: payload.audience || "targeted",
    recipient: payload.recipient,
    title: payload.title,
    message: payload.message,
    action_label: payload.action_label ?? payload.actionLabel,
    action_url: payload.action_url ?? payload.actionUrl,
    visible_from: payload.visible_from ?? payload.visibleFrom,
    is_important: payload.is_important ?? payload.isImportant ?? false,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, typeof value === "boolean" ? String(value) : value);
  });
  const { data } = await api.post("/agent/notifications/", form);
  return data;
}
