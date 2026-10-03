import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";
import { getServices } from "./services.js";
import { getProfile } from "./auth.js";
import { sendContactMessage } from "./contact.js";

const AGENT_STATUS = {
  submitted: "Envoyée",
  pending: "À traiter",
  in_progress: "En traitement",
  action_required: "Action requise",
  completed: "Terminée",
};

const CITIZEN_STATUS = {
  submitted: "Envoyée",
  pending: "En attente",
  in_progress: "En traitement",
  action_required: "Action requise",
  completed: "Terminée",
};

const STATUS_CODE = {
  "Envoyée": "submitted",
  "En attente": "pending",
  "À traiter": "pending",
  "En traitement": "in_progress",
  "Action requise": "action_required",
  "Terminée": "completed",
};

const PRIORITY_LABEL = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

function extractMeta(description = "") {
  const location = description.match(/(?:Localisation|Lieu)\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const category = description.match(/Catégorie\s*:\s*([^·\n]+)/i)?.[1]?.trim() || "";
  const type = description.match(/Type\s*:\s*([^·\n]+)/i)?.[1]?.trim() || "";
  const reportType = description.match(/Signalement\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const coordinates = description.match(/Coordonnées\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  const accuracy = description.match(/Précision GPS\s*:\s*([\d.]+)/i)?.[1];
  return {
    location,
    category,
    type,
    reportType,
    latitude: coordinates ? Number(coordinates[1]) : null,
    longitude: coordinates ? Number(coordinates[2]) : null,
    accuracy: accuracy ? Number(accuracy) : null,
  };
}

function buildHistory(statusCode, created, updated) {
  const processing = ["in_progress", "action_required", "completed"].includes(statusCode);
  const completed = statusCode === "completed";
  return [
    { key: "submitted", label: "Demande envoyée", at: created, state: "done" },
    { key: "received", label: "Demande reçue par la ville", at: created, state: "done" },
    { key: "assignment", label: "Prise en charge par un agent", at: processing ? updated : null, state: processing ? "done" : "next" },
    { key: "processing", label: "Traitement en cours", at: processing ? updated : null, state: processing ? "done" : "next" },
    { key: "resolved", label: "Résolue", at: completed ? updated : null, state: completed ? "done" : "next" },
  ];
}

function normalizeBase(item, labels) {
  const created = item.created_at || item.created || null;
  const updated = item.updated_at || item.updated || created;
  const meta = extractMeta(item.description || item.message || "");
  const reference = item.reference || item.ref || item.id;
  return {
    ...item,
    id: reference,
    ref: reference,
    reference,
    title: item.title || item.subject || "Demande citoyenne",
    description: item.description || item.message || "",
    service: item.service_name || item.serviceLabel || "Service municipal",
    serviceId: item.service ?? item.service_id ?? null,
    category: item.category || meta.category || "",
    requestType: item.requestType || meta.type || "question",
    reportType: item.report_type || item.reportType || meta.reportType || "",
    location: item.location || (meta.location || meta.latitude ? {
      label: meta.location || "Position GPS transmise",
      ...(meta.latitude !== null ? { latitude: meta.latitude } : {}),
      ...(meta.longitude !== null ? { longitude: meta.longitude } : {}),
      ...(meta.accuracy !== null ? { accuracy: meta.accuracy } : {}),
    } : null),
    district: item.district || meta.location || "Non précisé",
    attachments: item.attachments || [],
    statusCode: item.statusCode || item.status,
    status: labels[item.statusCode || item.status] || item.status || "En attente",
    priority: PRIORITY_LABEL[item.priority] || item.priority || "Normale",
    created: formatDateTime(created),
    updated: formatDateTime(updated),
    history: item.history?.length ? item.history : buildHistory(item.statusCode || item.status, created, updated),
  };
}

function normalizeCitizen(item) {
  return normalizeBase(item, CITIZEN_STATUS);
}

export function normalizeRequestForAgent(item) {
  const row = normalizeBase(item, AGENT_STATUS);
  return {
    ...row,
    citizen: item.citizen_name || item.citizen_email || item.citizen || "Citoyen",
    citizenId: String(item.citizen ?? item.citizen_id ?? ""),
    citizenEmail: item.citizen_email || "",
    assignedTo: item.assigned_to ?? null,
    assignedToName: item.assigned_to_name || "",
  };
}

async function resolveServiceId(serviceValue, category) {
  if (Number.isFinite(Number(serviceValue))) return Number(serviceValue);
  const services = await getServices();
  const wanted = String(serviceValue || category || "").toLowerCase().trim();

  const match = services.find((service) => {
    const values = [service.name, service.category, service.slug].filter(Boolean).map((value) => String(value).toLowerCase());
    return values.some((value) => value === wanted || value.includes(wanted) || wanted.includes(value));
  });

  const admin = services.find((service) => String(service.slug || "").toLowerCase() === "administration")
    || services.find((service) => String(service.name || "").toLowerCase().includes("administr"));

  return Number(match?.id || admin?.id || services[0]?.id || 0);
}

export async function createCitizenRequest(payload) {
  const serviceId = await resolveServiceId(payload.service, payload.category);
  if (!serviceId) throw new Error("Aucun service municipal n’est disponible.");

  const locationLine = payload.location?.label ? `\n\nLocalisation : ${payload.location.label}` : "";
  const coordinateLine = payload.location?.latitude != null && payload.location?.longitude != null
    ? `\nCoordonnées : ${payload.location.latitude}, ${payload.location.longitude}${payload.location?.accuracy != null ? `\nPrécision GPS : ${payload.location.accuracy}` : ""}`
    : "";
  const reportLine = payload.reportType ? `\nSignalement : ${payload.reportType}` : "";
  const metaLine = `\n\nType : ${payload.type || "question"} · Catégorie : ${payload.category || "Autre"}`;
  const attachmentLine = payload.attachments?.length
    ? `\nPièce jointe déclarée : ${payload.attachments.map((file) => file.name).join(", ")}`
    : "";

  const { data } = await api.post("/citizen/requests/", {
    service: serviceId,
    title: payload.subject || payload.title || "Demande citoyenne",
    description: `${payload.message || payload.description || ""}${locationLine}${coordinateLine}${reportLine}${metaLine}${attachmentLine}`.trim(),
    priority: payload.priority || (payload.type === "assistance" ? "high" : "normal"),
  });

  return {
    ...normalizeCitizen(data),
    category: payload.category || "",
    requestType: payload.type || "question",
    reportType: payload.reportType || "",
    location: payload.location || null,
    attachments: (payload.attachments || []).map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size || 0,
    })),
  };
}

export async function getCitizenRequests(params = {}) {
  const { data } = await api.get("/citizen/requests/", { params });
  return unwrapList(data).map(normalizeCitizen);
}

export async function getAgentRequests(params = {}) {
  const { data } = await api.get("/agent/requests/", { params });
  return unwrapList(data).map(normalizeRequestForAgent);
}

export async function getCitizenRequestById(reference) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/`);
  return normalizeCitizen(data);
}

export async function getCitizenRequest(reference) {
  return getCitizenRequestById(reference);
}

export async function getAgentRequestById(reference) {
  const { data } = await api.get(`/agent/requests/${encodeURIComponent(reference)}/`);
  return normalizeRequestForAgent(data);
}

export async function getAgentRequest(reference) {
  return getAgentRequestById(reference);
}

export async function updateRequestStatus(reference, status) {
  const { data } = await api.patch(`/agent/requests/${encodeURIComponent(reference)}/`, {
    status: STATUS_CODE[status] || status,
  });
  return normalizeRequestForAgent(data);
}

export async function updateAgentRequest(reference, changes) {
  const payload = { ...changes };
  if (payload.status) payload.status = STATUS_CODE[payload.status] || payload.status;
  const { data } = await api.patch(`/agent/requests/${encodeURIComponent(reference)}/`, payload);
  return normalizeRequestForAgent(data);
}

export async function addRequestInformation(reference, message) {
  const [request, profile] = await Promise.all([
    getCitizenRequestById(reference),
    getProfile(),
  ]);

  return sendContactMessage({
    name: profile?.display_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Citoyen",
    email: profile?.email || "",
    service: Number(request.serviceId) || undefined,
    subject: `Complément — ${reference}`,
    message: `Information complémentaire liée à la demande ${reference} :\n\n${message}`,
  });
}
