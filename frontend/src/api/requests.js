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
  cancelled: "Annulée",
  rejected: "Rejetée",
};

const CITIZEN_STATUS = {
  submitted: "Envoyée",
  pending: "En attente",
  in_progress: "En traitement",
  action_required: "Action requise",
  completed: "Terminée",
  cancelled: "Annulée",
  rejected: "Rejetée",
};

const STATUS_CODE = {
  "Envoyée": "submitted",
  "En attente": "pending",
  "À traiter": "pending",
  "En traitement": "in_progress",
  "Action requise": "action_required",
  "Terminée": "completed",
  "Annulée": "cancelled",
  "Rejetée": "rejected",
};

const PRIORITY_LABEL = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };
const PRIORITY_CODE = { Basse: "low", Normale: "normal", Haute: "high", Urgente: "urgent" };
const WORKFLOW_LABEL = {
  awaiting_handling: "À prendre en charge",
  agent_processing: "Traitement agent",
  citizen_action_required: "Attente citoyen",
  closed: "Clôturée",
};

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function toFormData(payload = {}) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value === "" && !["service", "assigned_to", "duplicate_of"].includes(key)) return;
    form.append(key, typeof value === "boolean" ? String(value) : value);
  });
  return form;
}

function extractMeta(description = "") {
  const location = description.match(/(?:Localisation|Lieu)\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const category = description.match(/Catégorie\s*:\s*([^·\n]+)/i)?.[1]?.trim() || "";
  const type = description.match(/Type\s*:\s*([^·\n]+)/i)?.[1]?.trim() || "";
  const reportType = description.match(/Signalement\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const coordinates = description.match(/Coordonnées\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  const accuracy = description.match(/Précision GPS\s*:\s*([\d.]+)/i)?.[1];
  return { location, category, type, reportType, latitude: coordinates ? Number(coordinates[1]) : null, longitude: coordinates ? Number(coordinates[2]) : null, accuracy: accuracy ? Number(accuracy) : null };
}

function normalizeTimeline(items = []) {
  return items.map((event) => ({
    ...event,
    key: event.id ?? `${event.event_type}-${event.created_at}`,
    label: event.title || event.status_label || "Mise à jour",
    title: event.title || event.status_label || "Mise à jour",
    message: event.message || "",
    at: event.created_at || null,
    createdAt: event.created_at || null,
    actorName: event.actor_name || "",
    actorRole: event.actor_role || "",
    isPublic: event.is_public !== false,
    eventType: event.event_type || "note",
    state: "done",
  }));
}

function buildHistory(statusCode, created, updated) {
  const processing = ["in_progress", "action_required", "completed", "rejected"].includes(statusCode);
  const completed = ["completed", "rejected", "cancelled"].includes(statusCode);
  return [
    { key: "submitted", label: "Demande envoyée", at: created, state: "done" },
    { key: "received", label: "Demande reçue par la ville", at: created, state: "done" },
    { key: "assignment", label: "Prise en charge par un agent", at: processing ? updated : null, state: processing ? "done" : "next" },
    { key: "processing", label: "Traitement en cours", at: processing ? updated : null, state: processing ? "done" : "next" },
    { key: "resolved", label: "Dossier clôturé", at: completed ? updated : null, state: completed ? "done" : "next" },
  ];
}

function normalizeBase(item, labels) {
  const created = item.created_at || item.created || null;
  const updated = item.updated_at || item.updated || created;
  const meta = extractMeta(item.description || item.message || "");
  const reference = item.reference || item.ref || item.id;
  const requestType = item.request_type || item.requestType || meta.type || "procedure";
  const timeline = normalizeTimeline(item.timeline || []);
  return {
    ...item,
    id: reference,
    ref: reference,
    reference,
    title: item.title || item.subject || "Demande citoyenne",
    description: item.description || item.message || "",
    service: item.service_name || item.serviceLabel || "Service municipal",
    serviceId: item.service?.id ?? item.service ?? item.service_id ?? null,
    category: item.category_label || item.category || meta.category || "",
    requestType: requestType === "report" ? "signalement" : requestType,
    requestTypeCode: requestType,
    reportType: item.incident_category || item.report_type || item.reportType || meta.reportType || "",
    location: item.location_text || item.location || (meta.location || meta.latitude ? {
      label: meta.location || "Position GPS transmise",
      ...(meta.latitude !== null ? { latitude: meta.latitude } : {}),
      ...(meta.longitude !== null ? { longitude: meta.longitude } : {}),
      ...(meta.accuracy !== null ? { accuracy: meta.accuracy } : {}),
    } : null),
    district: item.district || meta.location || "Non précisé",
    latitude: item.latitude ?? meta.latitude,
    longitude: item.longitude ?? meta.longitude,
    attachments: item.attachments || [],
    images: item.images || [],
    statusCode: item.statusCode || item.status,
    status: labels[item.statusCode || item.status] || item.status_label || item.status || "En attente",
    priorityCode: item.priority || "normal",
    priority: PRIORITY_LABEL[item.priority] || item.priority_label || item.priority || "Normale",
    createdAt: created,
    updatedAt: updated,
    created: formatDateTime(created),
    updated: formatDateTime(updated),
    history: timeline.length ? timeline : buildHistory(item.statusCode || item.status, created, updated),
    timeline,
  };
}

function normalizeCitizen(item) { return normalizeBase(item, CITIZEN_STATUS); }

export function normalizeRequestForAgent(item) {
  const row = normalizeBase(item, AGENT_STATUS);
  return {
    ...row,
    citizen: item.citizen_name || item.citizen_email || item.citizen || "Citoyen",
    citizenId: String(item.citizen?.id ?? item.citizen ?? item.citizen_id ?? ""),
    citizenEmail: item.citizen_email || "",
    assignedTo: item.assigned_to?.id ?? item.assigned_to ?? null,
    assignedToName: item.assigned_to_name || item.assigned_to?.display_name || "",
    needsTriage: Boolean(item.needs_triage),
    workflowState: item.workflow_state || "",
    workflowLabel: WORKFLOW_LABEL[item.workflow_state] || item.workflow_state || "",
    requiresAgentAction: Boolean(item.requires_agent_action),
    requiresCitizenAction: Boolean(item.requires_citizen_action),
    isClosed: Boolean(item.is_closed),
    resolutionSummary: item.resolution_summary || "",
    availableActions: item.available_actions || [],
    duplicateOf: item.duplicate_of ?? null,
  };
}

async function resolveServiceId(serviceValue, category) {
  if (Number.isFinite(Number(serviceValue))) return Number(serviceValue);
  const services = await getServices();
  const wanted = String(serviceValue || category || "").toLowerCase().trim();
  const match = services.find((service) => [service.name, service.category, service.slug].filter(Boolean).map((value) => String(value).toLowerCase()).some((value) => value === wanted || value.includes(wanted) || wanted.includes(value)));
  const admin = services.find((service) => String(service.slug || "").toLowerCase() === "administration") || services.find((service) => String(service.name || "").toLowerCase().includes("administr"));
  return Number(match?.id || admin?.id || services[0]?.id || 0);
}

export async function createCitizenRequest(payload) {
  const serviceId = await resolveServiceId(payload.service, payload.category);
  if (!serviceId) throw new Error("Aucun service municipal n’est disponible.");
  const locationLine = payload.location?.label ? `\n\nLocalisation : ${payload.location.label}` : "";
  const coordinateLine = payload.location?.latitude != null && payload.location?.longitude != null ? `\nCoordonnées : ${payload.location.latitude}, ${payload.location.longitude}${payload.location?.accuracy != null ? `\nPrécision GPS : ${payload.location.accuracy}` : ""}` : "";
  const reportLine = payload.reportType ? `\nSignalement : ${payload.reportType}` : "";
  const metaLine = `\n\nType : ${payload.type || "question"} · Catégorie : ${payload.category || "Autre"}`;
  const attachmentLine = payload.attachments?.length ? `\nPièce jointe déclarée : ${payload.attachments.map((file) => file.name).join(", ")}` : "";
  const { data } = await api.post("/citizen/requests/", {
    service: serviceId,
    title: payload.subject || payload.title || "Demande citoyenne",
    description: `${payload.message || payload.description || ""}${locationLine}${coordinateLine}${reportLine}${metaLine}${attachmentLine}`.trim(),
    priority: payload.priority || (payload.type === "assistance" ? "high" : "normal"),
  });
  return { ...normalizeCitizen(data), category: payload.category || "", requestType: payload.type || "question", reportType: payload.reportType || "", location: payload.location || null, attachments: (payload.attachments || []).map((file) => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size || 0 })) };
}

export async function getCitizenRequests(params = {}) {
  const { data } = await api.get("/citizen/requests/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeCitizen);
}

export async function getAgentRequestsPage(params = {}) {
  const { data } = await api.get("/agent/requests/", { params: cleanParams(params) });
  return {
    count: Number(data?.count ?? unwrapList(data).length),
    next: data?.next || null,
    previous: data?.previous || null,
    results: unwrapList(data).map(normalizeRequestForAgent),
  };
}

export async function getAgentRequests(params = {}) { return (await getAgentRequestsPage(params)).results; }

export async function getAgentRequestCount(params = {}) { return (await getAgentRequestsPage({ ...params, page_size: 1 })).count; }

export async function getAgentRequestSummary() {
  try {
    const { data } = await api.get("/agent/requests/summary/");
    return data || {};
  } catch {
    const [awaiting, needsAction, active, closed] = await Promise.all([
      getAgentRequestCount({ awaiting_handling: true }),
      getAgentRequestCount({ needs_action: true }),
      getAgentRequestCount({ workflow_state: "agent_processing" }),
      getAgentRequestCount({ workflow_state: "closed" }),
    ]);
    return { awaiting_handling: awaiting, needs_action: needsAction, agent_processing: active, closed };
  }
}

export async function getCitizenRequestById(reference) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/`);
  return normalizeCitizen(data);
}
export async function getCitizenRequest(reference) { return getCitizenRequestById(reference); }

export async function getAgentRequestById(reference) {
  const { data } = await api.get(`/agent/requests/${encodeURIComponent(reference)}/`);
  return normalizeRequestForAgent(data);
}
export async function getAgentRequest(reference) { return getAgentRequestById(reference); }

export async function updateRequestStatus(reference, status, extra = {}) {
  return updateAgentRequest(reference, { ...extra, status });
}

export async function updateAgentRequest(reference, changes) {
  const payload = { ...changes };
  if (payload.status) payload.status = STATUS_CODE[payload.status] || payload.status;
  if (payload.priority) payload.priority = PRIORITY_CODE[payload.priority] || payload.priority;
  delete payload.workflow_state;
  delete payload.requires_agent_action;
  delete payload.requires_citizen_action;
  const { data } = await api.patch(`/agent/requests/${encodeURIComponent(reference)}/`, toFormData(payload));
  return normalizeRequestForAgent(data);
}

export async function addAgentRequestTimeline(reference, payload = {}) {
  const form = new FormData();
  form.append("title", payload.title || "Mise à jour du dossier");
  if (payload.message) form.append("message", payload.message);
  form.append("is_public", String(payload.is_public ?? payload.isPublic ?? true));
  (payload.images || []).forEach((file) => form.append("images", file));
  (payload.image_captions || payload.imageCaptions || []).forEach((caption) => form.append("image_captions", caption));
  const { data } = await api.post(`/agent/requests/${encodeURIComponent(reference)}/timeline/`, form);
  return data;
}

export async function addRequestInformation(reference, message) {
  const [request, profile] = await Promise.all([getCitizenRequestById(reference), getProfile()]);
  return sendContactMessage({
    name: profile?.display_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Citoyen",
    email: profile?.email || "",
    service: Number(request.serviceId) || undefined,
    subject: `Complément — ${reference}`,
    message: `Information complémentaire liée à la demande ${reference} :\n\n${message}`,
  });
}

export async function reopenAgentReport(reference, reason) {
  const form = new FormData();
  form.append("reason", reason);
  const { data } = await api.post(`/agent/reports/${encodeURIComponent(reference)}/reopen/`, form);
  return normalizeRequestForAgent(data);
}

export async function addAgentReportAttachments(reference, files = [], { captions = [], isPublic = false } = {}) {
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  captions.forEach((caption) => form.append("image_captions", caption));
  form.append("is_public", String(Boolean(isPublic)));
  const { data } = await api.post(`/agent/reports/${encodeURIComponent(reference)}/attachments/`, form);
  return data;
}
