import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

export function normalizeAuditEvent(item = {}) {
  return {
    ...item,
    id: item.id,
    createdAt: item.created_at || "",
    createdLabel: formatDateTime(item.created_at, { withYear: true }),
    actorName: item.actor || item.actor_name || "Agent",
    actorRole: item.actor_role || "agent",
    action: item.action || "action",
    resourceType: item.resource_type || "",
    resourceId: item.resource_id || "",
    resourceReference: item.resource_reference || "",
    subject: item.subject || "",
    summary: item.summary || item.action || "Action enregistrée",
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
