import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

export const API_STATUS = Object.freeze({
  submitted: "Envoyée",
  pending: "À traiter",
  in_progress: "En traitement",
  action_required: "Action requise",
  completed: "Terminée",
});

export const CITIZEN_STATUS = Object.freeze({
  submitted: "Envoyée",
  pending: "En attente",
  in_progress: "En traitement",
  action_required: "Action requise",
  completed: "Terminée",
});

export const STATUS_CODE = Object.freeze({
  "Envoyée": "submitted",
  "En attente": "pending",
  "À traiter": "pending",
  "En traitement": "in_progress",
  "Action requise": "action_required",
  "Terminée": "completed",
});

export const PRIORITY_LABEL = Object.freeze({
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
});

export const PRIORITY_CODE = Object.freeze({
  Basse: "low",
  Normale: "normal",
  Haute: "high",
  Urgente: "urgent",
});

function baseRequest(item, statusLabels) {
  return {
    ...item,
    id: item.reference,
    ref: item.reference,
    service: item.service_name || "Service non attribué",
    serviceId: item.service,
    statusCode: item.status,
    status: statusLabels[item.status] || item.status,
    priorityCode: item.priority,
    priority: PRIORITY_LABEL[item.priority] || item.priority,
    created: formatDateTime(item.created_at),
    updated: formatDateTime(item.updated_at),
  };
}

export function normalizeRequestForCitizen(item) {
  return baseRequest(item, CITIZEN_STATUS);
}

export function normalizeRequestForAgent(item) {
  const normalized = baseRequest(item, API_STATUS);
  return {
    ...normalized,
    citizen: item.citizen_name || item.citizen_email || `Citoyen ${item.citizen}`,
    citizenId: String(item.citizen ?? ""),
    citizenEmail: item.citizen_email || "",
    assignedTo: item.assigned_to ?? null,
    assignedToName: item.assigned_to_name || "",
  };
}

function toPatchPayload(changes) {
  const payload = { ...changes };
  if (payload.status && STATUS_CODE[payload.status]) payload.status = STATUS_CODE[payload.status];
  if (payload.priority && PRIORITY_CODE[payload.priority]) payload.priority = PRIORITY_CODE[payload.priority];
  if (payload.assigned_to === "" || payload.assigned_to === "null") payload.assigned_to = null;
  return payload;
}

export async function getCitizenRequests(params = {}) {
  const { data } = await api.get("/citizen/requests/", { params });
  return unwrapList(data).map(normalizeRequestForCitizen);
}

export async function createCitizenRequest(payload) {
  const { data } = await api.post("/citizen/requests/", payload);
  return normalizeRequestForCitizen(data);
}

export async function getCitizenRequest(reference) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/`);
  return normalizeRequestForCitizen(data);
}

export async function getAgentRequests(params = {}) {
  const { data } = await api.get("/agent/requests/", { params });
  return unwrapList(data).map(normalizeRequestForAgent);
}

export async function getAgentRequest(reference) {
  const { data } = await api.get(`/agent/requests/${encodeURIComponent(reference)}/`);
  return normalizeRequestForAgent(data);
}

export async function updateAgentRequest(reference, changes) {
  const { data } = await api.patch(`/agent/requests/${encodeURIComponent(reference)}/`, toPatchPayload(changes));
  return normalizeRequestForAgent(data);
}

export async function getAdminRequests(params = {}) {
  const { data } = await api.get("/admin/requests/", { params });
  return unwrapList(data).map(normalizeRequestForAgent);
}

export async function getAdminRequest(reference) {
  const { data } = await api.get(`/admin/requests/${encodeURIComponent(reference)}/`);
  return normalizeRequestForAgent(data);
}

export async function updateAdminRequest(reference, changes) {
  const { data } = await api.patch(`/admin/requests/${encodeURIComponent(reference)}/`, toPatchPayload(changes));
  return normalizeRequestForAgent(data);
}
