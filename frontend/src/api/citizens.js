import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";
import { normalizeRequestForAgent } from "./requests.js";

function normalizeCitizen(item) {
  return {
    ...item,
    name: item.display_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.email,
    requests: item.request_count ?? 0,
    status: item.is_active ? "Actif" : "Inactif",
    joinedLabel: formatDateTime(item.date_joined, { dateOnly: true, withYear: true }),
    lastLoginLabel: formatDateTime(item.last_login),
    requestItems: (item.recent_requests || []).map(normalizeRequestForAgent),
  };
}

export async function getCitizens(params = {}) {
  const { data } = await api.get("/agent/citizens/", { params });
  return unwrapList(data).map(normalizeCitizen);
}

export async function getCitizen(id) {
  const { data } = await api.get(`/agent/citizens/${encodeURIComponent(id)}/`);
  return normalizeCitizen(data);
}

export async function getAssignees() {
  const { data } = await api.get("/agent/assignees/");
  return unwrapList(data);
}
