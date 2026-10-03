import { api } from "./api.js";

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

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function citizenRequest(item) {
  return {
    ...item,
    id: item.reference,
    ref: item.reference,
    service: item.service_name || "Service non attribué",
    serviceId: item.service,
    statusCode: item.status,
    status: CITIZEN_STATUS[item.status] || item.status,
    priorityCode: item.priority,
    priority: PRIORITY_LABEL[item.priority] || item.priority,
    created: dateTime(item.created_at),
    updated: dateTime(item.updated_at),
  };
}

function agentRequest(item) {
  return {
    ...item,
    id: item.reference,
    ref: item.reference,
    citizen: item.citizen_name || item.citizen_email || `Citoyen ${item.citizen}`,
    citizenId: String(item.citizen ?? ""),
    citizenEmail: item.citizen_email || "",
    service: item.service_name || "Service non attribué",
    serviceId: item.service,
    statusCode: item.status,
    status: API_STATUS[item.status] || item.status,
    priorityCode: item.priority,
    priority: PRIORITY_LABEL[item.priority] || item.priority,
    created: dateTime(item.created_at),
    updated: dateTime(item.updated_at),
  };
}

export async function getCitizenRequests(params = {}) {
  const { data } = await api.get("/citizen/requests/", { params });
  return (Array.isArray(data) ? data : data?.results || []).map(citizenRequest);
}

export async function createCitizenRequest(payload) {
  const { data } = await api.post("/citizen/requests/", payload);
  return citizenRequest(data);
}

export async function getCitizenRequest(reference) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/`);
  return citizenRequest(data);
}

export async function getAgentRequests(params = {}) {
  const { data } = await api.get("/agent/requests/", { params });
  return (Array.isArray(data) ? data : data?.results || []).map(agentRequest);
}

export async function getAgentRequest(reference) {
  const { data } = await api.get(`/agent/requests/${encodeURIComponent(reference)}/`);
  return agentRequest(data);
}

export async function updateAgentRequest(reference, changes) {
  const payload = { ...changes };
  if (payload.status && STATUS_CODE[payload.status]) payload.status = STATUS_CODE[payload.status];
  if (payload.priority && PRIORITY_CODE[payload.priority]) payload.priority = PRIORITY_CODE[payload.priority];
  const { data } = await api.patch(`/agent/requests/${encodeURIComponent(reference)}/`, payload);
  return agentRequest(data);
}
