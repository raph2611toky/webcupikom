import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function stringifyEntity(value, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map((entry) => stringifyEntity(entry)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const parts = [
      value.display_name,
      value.name,
      value.title,
      value.label,
      value.reference,
      value.email,
      value.role,
      value.status_label,
      value.status,
      value.id,
    ].filter((entry, index, array) => entry !== undefined && entry !== null && entry !== "" && array.indexOf(entry) === index);
    if (parts.length) return parts.join(" · ");
    try { return JSON.stringify(value); }
    catch { return fallback; }
  }
  return fallback;
}

export function normalizeAuditEvent(item = {}) {
  return {
    ...item,
    id: item.id,
    createdAt: item.created_at || "",
    createdLabel: formatDateTime(item.created_at, { withYear: true }),
    actorName: stringifyEntity(item.actor_name || item.actor, "Agent"),
    actorRole: stringifyEntity(item.actor_role || item.actor?.role, "agent"),
    action: item.action || "action",
    resourceType: item.resource_type || "",
    resourceId: stringifyEntity(item.resource_id || ""),
    resourceReference: stringifyEntity(item.resource_reference || item.reference || ""),
    subject: stringifyEntity(item.subject || item.subject_name || item.citizen || item.citizen_name || item.metadata?.subject, ""),
    summary: stringifyEntity(item.summary, item.action || "Action enregistrée"),
    changes: item.changes && typeof item.changes === "object" ? item.changes : {},
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
    visibility: item.visibility || "staff",
  };
}

export async function getAgentAudit(params = {}) {
  const { data } = await api.get("/agent/audit/", { params: cleanParams(params) });
  return {
    count: Number(data?.count ?? unwrapList(data).length),
    next: data?.next || null,
    previous: data?.previous || null,
    results: unwrapList(data).map(normalizeAuditEvent),
  };
}

export async function getAgentAuditEvent(id) {
  const { data } = await api.get(`/agent/audit/${encodeURIComponent(id)}/`);
  return normalizeAuditEvent(data);
}
