import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";
import { normalizeRequestForAgent } from "./requests.js";

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function normalizeCitizen(item) {
  return {
    ...item,
    name: item.display_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.email,
    requests: Number(item.request_count ?? 0),
    appointments: Number(item.appointment_count ?? 0),
    status: item.is_active ? "Actif" : "Inactif",
    profileCompleted: String(item.profile_completed ?? "").toLowerCase() === "true" || item.profile_completed === true,
    joinedLabel: formatDateTime(item.date_joined, { dateOnly: true, withYear: true }),
    lastLoginLabel: formatDateTime(item.last_login),
    updatedLabel: formatDateTime(item.updated_at),
    requestItems: (item.recent_requests || []).map(normalizeRequestForAgent),
  };
}

export async function getCitizensPage(params = {}) {
  const { data } = await api.get("/agent/citizens/", { params: cleanParams(params) });
  return {
    count: Number(data?.count ?? unwrapList(data).length),
    next: data?.next || null,
    previous: data?.previous || null,
    results: unwrapList(data).map(normalizeCitizen),
  };
}

export async function getCitizens(params = {}) {
  return (await getCitizensPage(params)).results;
}

export async function getCitizen(id) {
  const { data } = await api.get(`/agent/citizens/${encodeURIComponent(id)}/`);
  return normalizeCitizen(data);
}

export async function updateCitizen(id, payload = {}) {
  const { data } = await api.patch(`/agent/citizens/${encodeURIComponent(id)}/`, payload);
  return normalizeCitizen(data);
}

export async function getAssignees() {
  const { data } = await api.get("/agent/assignees/");
  return unwrapList(data);
}
