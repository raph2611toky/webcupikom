import { api, getAccessToken } from "./api.js";
import { env } from "../config/env.js";
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
  rejected: "Non retenue",
};

const CITIZEN_STATUS = {
  submitted: "Envoyée",
  pending: "En attente",
  in_progress: "En traitement",
  action_required: "Action requise",
  completed: "Terminée",
  cancelled: "Annulée",
  rejected: "Non retenue",
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
  "Non retenue": "rejected",
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

function appendFormValue(form, key, value, { allowEmpty = false } = {}) {
  if (value === undefined || value === null) return;
  if (value === "" && !allowEmpty) return;
  form.append(key, typeof value === "boolean" ? String(value) : String(value));
}

function normalizeAttachments(items = []) {
  return (items || []).map((file, index) => ({
    ...file,
    id: file.id ?? file.uuid ?? `attachment-${index}`,
    name: file.original_name || file.name || file.filename || `Pièce ${index + 1}`,
    type: file.content_type || file.type || "application/octet-stream",
    size: Number(file.size_bytes ?? file.size ?? 0),
    caption: file.caption || "",
    uploaderName: file.uploader_name || "",
    isPublic: file.is_public !== false,
    downloadUrl: file.download_url || file.url || "",
    createdAt: file.created_at || null,
  }));
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
    attachments: normalizeAttachments(event.attachments || []),
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
  const latitude = item.latitude ?? meta.latitude;
  const longitude = item.longitude ?? meta.longitude;
  const locationLabel = item.location_text || (typeof item.location === "string" ? item.location : item.location?.label) || meta.location || "";
  const location = (locationLabel || latitude != null || longitude != null) ? {
    label: locationLabel || "Position GPS transmise",
    ...(latitude != null ? { latitude: Number(latitude) } : {}),
    ...(longitude != null ? { longitude: Number(longitude) } : {}),
    ...(item.location_accuracy != null || meta.accuracy != null ? { accuracy: Number(item.location_accuracy ?? meta.accuracy) } : {}),
  } : null;
  return {
    ...item,
    id: reference,
    numericId: item.id ?? null,
    ref: reference,
    reference,
    title: item.title || item.subject || "Demande citoyenne",
    description: item.description || item.message || "",
    service: item.service_name || item.serviceLabel || (typeof item.service === "object" ? item.service?.name : "") || "Service municipal",
    serviceId: item.service?.id ?? item.service ?? item.service_id ?? null,
    category: item.category_label || item.category || meta.category || "",
    requestType: requestType === "report" ? "signalement" : "procedure",
    requestTypeCode: requestType === "signalement" ? "report" : requestType,
    reportType: item.incident_category || item.report_type || item.reportType || meta.reportType || "",
    location,
    district: item.district || "",
    street: item.street || "",
    building: item.building || "",
    landmark: item.landmark || "",
    latitude,
    longitude,
    locationAccuracy: item.location_accuracy ?? meta.accuracy ?? null,
    severityCode: item.severity || "",
    severity: item.severity_label || item.severity || "",
    dangerPresent: Boolean(item.danger_present),
    peopleAffected: item.people_affected ?? null,
    frequency: item.frequency || "",
    allowContact: item.allow_contact !== false,
    preferredContact: item.preferred_contact || "platform",
    contactPhone: item.contact_phone || "",
    attachments: normalizeAttachments(item.attachments || []),
    images: item.images || [],
    statusCode: item.statusCode || item.status,
    status: labels[item.statusCode || item.status] || item.status_label || item.status || "En attente",
    priorityCode: item.priority || "normal",
    priority: PRIORITY_LABEL[item.priority] || item.priority_label || item.priority || "Normale",
    resolutionSummary: item.resolution_summary || "",
    cancellationReason: item.cancellation_reason || "",
    reopenedCount: Number(item.reopened_count || 0),
    isClosed: item.is_closed !== undefined && item.is_closed !== null ? Boolean(item.is_closed) : ["completed","cancelled","rejected"].includes(item.status),
    availableActions: item.available_actions || [],
    workflowState: item.workflow_state || "",
    requiresAgentAction: Boolean(item.requires_agent_action),
    requiresCitizenAction: Boolean(item.requires_citizen_action),
    supportCount: Number(item.support_count ?? 0),
    agentReplyCount: Number(item.agent_reply_count ?? 0),
    hasAgentReply: item.has_agent_reply !== undefined ? Boolean(item.has_agent_reply) : Number(item.agent_reply_count ?? 0) > 0,
    lastAgentReplyAt: item.last_agent_reply_at || null,
    confirmation: item.confirmation || null,
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
    isClosed: item.is_closed !== undefined && item.is_closed !== null ? Boolean(item.is_closed) : ["completed","cancelled","rejected"].includes(item.status),
    resolutionSummary: item.resolution_summary || "",
    availableActions: item.available_actions || [],
    duplicateOf: item.duplicate_of?.id ?? item.duplicate_of ?? null,
    duplicateOfReference: item.duplicate_of_reference || item.duplicate_of?.reference || item.duplicate_reference || "",
  };
}

async function resolveServiceId(serviceValue, category) {
  if (serviceValue !== "" && serviceValue !== undefined && serviceValue !== null && Number.isFinite(Number(serviceValue))) return Number(serviceValue);
  const wanted = String(serviceValue || category || "").toLowerCase().trim();
  if (!wanted) return 0;
  const services = await getServices();
  const match = services.find((service) => [service.name, service.category, service.slug]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .some((value) => value === wanted || value.includes(wanted) || wanted.includes(value)));
  return Number(match?.id || 0);
}

export async function getCitizenReportCategories() {
  const { data } = await api.get("/citizen/reports/categories/");
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    limits: data?.limits || {},
    locationRule: data?.location_rule || "",
    dangerGuidance: data?.danger_guidance || "",
  };
}

export async function createCitizenRequest(payload) {
  const requestedType = payload.request_type || payload.requestType || payload.type || "procedure";
  const requestType = requestedType === "report" || requestedType === "signalement" ? "report" : "procedure";
  const serviceId = await resolveServiceId(payload.service, payload.category);
  const form = new FormData();
  const citizenKind = !["procedure", "report", "signalement", "demarche"].includes(String(payload.type || "")) ? payload.type : "";
  const baseDescription = String(payload.message || payload.description || "").trim();
  const description = citizenKind ? `[${citizenKind}] ${baseDescription}`.trim() : baseDescription;

  appendFormValue(form, "title", payload.subject || payload.title || (requestType === "report" ? "Signalement citoyen" : "Demande citoyenne"));
  appendFormValue(form, "description", description || "Demande transmise depuis l’espace citoyen.");
  appendFormValue(form, "request_type", requestType);
  if (serviceId) appendFormValue(form, "service", serviceId);

  const location = payload.location || {};
  appendFormValue(form, "location_text", payload.location_text ?? location.label ?? payload.locationLabel);
  appendFormValue(form, "latitude", payload.latitude ?? location.latitude);
  appendFormValue(form, "longitude", payload.longitude ?? location.longitude);
  appendFormValue(form, "location_accuracy", payload.location_accuracy ?? location.accuracy);
  appendFormValue(form, "district", payload.district);
  appendFormValue(form, "street", payload.street);
  appendFormValue(form, "building", payload.building);
  appendFormValue(form, "landmark", payload.landmark);

  if (requestType === "report") {
    appendFormValue(form, "incident_category", payload.incident_category || payload.incidentCategory || payload.reportType || payload.categoryCode);
    appendFormValue(form, "occurred_at", payload.occurred_at || payload.occurredAt);
    appendFormValue(form, "frequency", payload.frequency || "once");
    appendFormValue(form, "infrastructure_id", payload.infrastructure_id || payload.infrastructureId);
    appendFormValue(form, "severity", payload.severity || "minor");
    appendFormValue(form, "danger_present", payload.danger_present ?? payload.dangerPresent ?? false);
    appendFormValue(form, "people_affected", payload.people_affected ?? payload.peopleAffected);
    appendFormValue(form, "impacts_accessibility", payload.impacts_accessibility ?? payload.impactsAccessibility ?? false);
    appendFormValue(form, "accessibility_details", payload.accessibility_details ?? payload.accessibilityDetails);
    appendFormValue(form, "allow_contact", payload.allow_contact ?? payload.allowContact ?? true);
    appendFormValue(form, "preferred_contact", payload.preferred_contact ?? payload.preferredContact ?? "platform");
    appendFormValue(form, "contact_phone", payload.contact_phone ?? payload.contactPhone);
  }

  const files = payload.images || payload.attachments || [];
  files.forEach((file) => { if (file instanceof Blob) form.append("images", file); });
  const captions = payload.image_captions || payload.imageCaptions || [];
  captions.forEach((caption) => appendFormValue(form, "image_captions", caption));

  const { data } = await api.post("/citizen/requests/", form);
  return normalizeCitizen(data);
}

function filterCitizenRequestRows(rows, params = {}) {
  const wantedType = params.request_type || params.requestType || params.type || "";
  const normalizedType = ["report", "signalement"].includes(String(wantedType).toLowerCase())
    ? "report"
    : ["procedure", "demarche", "démarche"].includes(String(wantedType).toLowerCase())
      ? "procedure"
      : "";
  if (!normalizedType) return rows;
  return rows.filter((row) => row.requestTypeCode === normalizedType || (normalizedType === "report" && row.requestType === "signalement"));
}

function citizenListParams(params = {}) {
  const wantedType = params.type || params.request_type || params.requestType || "";
  const normalizedType = ["report", "signalement"].includes(String(wantedType).toLowerCase())
    ? "report"
    : ["procedure", "demarche", "démarche"].includes(String(wantedType).toLowerCase())
      ? "procedure"
      : "";
  const allowed = [
    "status", "created_from", "created_to", "has_images", "priority", "handling_route",
    "alert_status", "severity", "incident_category", "district", "search", "ordering", "page", "page_size",
  ];
  const result = Object.fromEntries(allowed.flatMap((key) => params[key] !== undefined ? [[key, params[key]]] : []));
  if (normalizedType) result.type = normalizedType;
  return cleanParams(result);
}

export async function getCitizenRequestsPage(params = {}) {
  const { data } = await api.get("/citizen/requests/", { params: citizenListParams(params) });
  const results = filterCitizenRequestRows(unwrapList(data).map(normalizeCitizen), params);
  return {
    count: Number(data?.count ?? results.length),
    next: data?.next || null,
    previous: data?.previous || null,
    results,
  };
}

export async function getCitizenRequests(params = {}) {
  return (await getCitizenRequestsPage(params)).results;
}

export async function getAllCitizenRequests(params = {}) {
  const rows = [];
  let page = 1;
  for (let guard = 0; guard < 100; guard += 1) {
    const { data } = await api.get("/citizen/requests/", {
      params: citizenListParams({ ...params, page, page_size: params.page_size || 100 }),
    });
    rows.push(...unwrapList(data).map(normalizeCitizen));
    if (!data?.next || !Array.isArray(data?.results)) break;
    page += 1;
  }
  return filterCitizenRequestRows(rows, params);
}

function normalizeSupportableCitizenRequest(item = {}) {
  return {
    reference: item.reference || "",
    title: item.public_title || item.category_label || "Signalement citoyen",
    categoryCode: item.incident_category || "",
    categoryLabel: item.category_label || item.incident_category || "Signalement",
    district: item.district || "",
    serviceName: item.service_name || "",
    status: item.status || "submitted",
    statusLabel: item.status_label || CITIZEN_STATUS[item.status] || item.status || "",
    createdAt: item.created_at || null,
    supportCount: Number(item.support_count || 0),
    isSupported: Boolean(item.is_supported),
    canSupport: Boolean(item.can_support),
  };
}

export async function getSupportableCitizenRequests(params = {}) {
  const { data } = await api.get("/citizen/supportable-requests/", { params: cleanParams(params) });
  return {
    count: Number(data?.count ?? unwrapList(data).length),
    next: data?.next || null,
    previous: data?.previous || null,
    results: unwrapList(data).map(normalizeSupportableCitizenRequest),
  };
}

export async function getCitizenRequestSupport(reference) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/support/`);
  return {
    reference: data?.reference || reference,
    supported: Boolean(data?.supported),
    supportCount: Number(data?.support_count || 0),
    supportedAt: data?.supported_at || null,
    canSupport: Boolean(data?.can_support),
    confirmation: data?.confirmation || "",
  };
}

export async function setCitizenRequestSupport(reference, supported) {
  const endpoint = `/citizen/requests/${encodeURIComponent(reference)}/support/`;
  const { data } = supported ? await api.post(endpoint, {}) : await api.delete(endpoint);
  return {
    reference: data?.reference || reference,
    supported: Boolean(data?.supported),
    supportCount: Number(data?.support_count || 0),
    supportedAt: data?.supported_at || null,
    canSupport: Boolean(data?.can_support),
    confirmation: data?.confirmation || (supported ? "Votre soutien a bien été enregistré." : "Votre soutien a été retiré."),
  };
}

async function getStaffRequestsPage(scope, params = {}) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  const { data } = await api.get(`/${safeScope}/requests/`, { params: cleanParams(params) });
  return {
    count: Number(data?.count ?? unwrapList(data).length),
    next: data?.next || null,
    previous: data?.previous || null,
    results: unwrapList(data).map(normalizeRequestForAgent),
  };
}

export async function getAgentRequestsPage(params = {}) { return getStaffRequestsPage("agent", params); }
export async function getAdminRequestsPage(params = {}) { return getStaffRequestsPage("admin", params); }
export async function getAgentRequests(params = {}) { return (await getAgentRequestsPage(params)).results; }
export async function getAdminRequests(params = {}) { return (await getAdminRequestsPage(params)).results; }
export async function getAgentRequestCount(params = {}) { return (await getAgentRequestsPage({ ...params, page_size: 1 })).count; }
export async function getAdminRequestCount(params = {}) { return (await getAdminRequestsPage({ ...params, page_size: 1 })).count; }

async function getStaffRequestSummary(scope) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  try {
    const { data } = await api.get(`/${safeScope}/requests/summary/`);
    return data || {};
  } catch {
    const getCount = safeScope === "admin" ? getAdminRequestCount : getAgentRequestCount;
    const [awaiting, needsAction, active, closed] = await Promise.all([
      getCount({ awaiting_handling: true }),
      getCount({ needs_action: true }),
      getCount({ workflow_state: "agent_processing" }),
      getCount({ workflow_state: "closed" }),
    ]);
    return { awaiting_handling: awaiting, needs_agent_action: needsAction, agent_processing: active, closed };
  }
}

export async function getAgentRequestSummary() { return getStaffRequestSummary("agent"); }
export async function getAdminRequestSummary() { return getStaffRequestSummary("admin"); }

export async function getCitizenRequestById(reference) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/`);
  return normalizeCitizen(data);
}
export async function getCitizenRequest(reference) { return getCitizenRequestById(reference); }

async function getStaffRequestById(scope, reference) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  const { data } = await api.get(`/${safeScope}/requests/${encodeURIComponent(reference)}/`);
  return normalizeRequestForAgent(data);
}
export async function getAgentRequestById(reference) { return getStaffRequestById("agent", reference); }
export async function getAdminRequestById(reference) { return getStaffRequestById("admin", reference); }
export async function getAgentRequest(reference) { return getAgentRequestById(reference); }
export async function getAdminRequest(reference) { return getAdminRequestById(reference); }

function normalizeSimilarRequest(item = {}) {
  const source = item.request || item.similar_request || item.candidate || item.result || item;
  const request = normalizeRequestForAgent(source || {});
  const rawScore = Number(
    item.similarity_percent ?? item.similarity_score ?? item.score ?? item.similarity ?? item.match_score ?? item.relevance ??
    source?.similarity_score ?? source?.score ?? 0
  );
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore <= 1 ? rawScore * 100 : rawScore)) : 0;
  const reasons = item.reasons || item.match_reasons || item.matched_fields || item.signals || source?.match_reasons || [];
  const reasonList = Array.isArray(reasons)
    ? reasons.map((value) => typeof value === "string" ? value : value?.label || value?.name || value?.field || JSON.stringify(value)).filter(Boolean)
    : typeof reasons === "string" ? [reasons] : [];
  const distance = item.distance_meters ?? item.distance ?? item.gps_distance_meters ?? item.gps_distance_km ?? null;
  return {
    ...request,
    description: source?.description_excerpt || request.description,
    matchScore: score,
    matchScoreLabel: `${Math.round(score)} %`,
    matchReasons: reasonList,
    matchDistance: distance,
  };
}

async function getStaffSimilarRequests(scope, reference) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  const { data } = await api.get(`/${safeScope}/requests/${encodeURIComponent(reference)}/similar/`);
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.similar_requests)
        ? data.similar_requests
        : Array.isArray(data?.similar)
          ? data.similar
          : Array.isArray(data?.matches)
            ? data.matches
            : Array.isArray(data?.items)
              ? data.items
              : [];
  return rows
    .map(normalizeSimilarRequest)
    .filter((item) => item.ref && String(item.ref) !== String(reference))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export async function getAgentSimilarRequests(reference) { return getStaffSimilarRequests("agent", reference); }
export async function getAdminSimilarRequests(reference) { return getStaffSimilarRequests("admin", reference); }

export async function linkAgentRequestDuplicate(reference, duplicateId) {
  return updateAgentRequest(reference, { duplicate_of: duplicateId });
}

export async function unlinkAgentRequestDuplicate(reference) {
  return updateAgentRequest(reference, { duplicate_of: "" });
}
export async function linkAdminRequestDuplicate(reference, duplicateId) {
  return updateAdminRequest(reference, { duplicate_of: duplicateId });
}
export async function unlinkAdminRequestDuplicate(reference) {
  return updateAdminRequest(reference, { duplicate_of: "" });
}

export async function updateRequestStatus(reference, status, extra = {}) {
  return updateAgentRequest(reference, { ...extra, status });
}

async function updateStaffRequest(scope, reference, changes) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  const payload = { ...changes };
  if (payload.status) payload.status = STATUS_CODE[payload.status] || payload.status;
  if (payload.priority) payload.priority = PRIORITY_CODE[payload.priority] || payload.priority;
  delete payload.workflow_state;
  delete payload.requires_agent_action;
  delete payload.requires_citizen_action;
  const { data } = await api.patch(`/${safeScope}/requests/${encodeURIComponent(reference)}/`, toFormData(payload));
  return normalizeRequestForAgent(data);
}

export async function updateAgentRequest(reference, changes) { return updateStaffRequest("agent", reference, changes); }
export async function updateAdminRequest(reference, changes) { return updateStaffRequest("admin", reference, changes); }

async function addStaffRequestTimeline(scope, reference, payload = {}) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  const form = new FormData();
  form.append("title", payload.title || "Mise à jour du dossier");
  if (payload.message) form.append("message", payload.message);
  form.append("is_public", String(payload.is_public ?? payload.isPublic ?? true));
  (payload.images || []).forEach((file) => form.append("images", file));
  (payload.image_captions || payload.imageCaptions || []).forEach((caption) => form.append("image_captions", caption));
  const { data } = await api.post(`/${safeScope}/requests/${encodeURIComponent(reference)}/timeline/`, form);
  return normalizeTimeline([data])[0] || data;
}
export async function addAgentRequestTimeline(reference, payload = {}) { return addStaffRequestTimeline("agent", reference, payload); }
export async function addAdminRequestTimeline(reference, payload = {}) { return addStaffRequestTimeline("admin", reference, payload); }

async function getRequestReplies(scope, reference, params = {}) {
  const safeScope = scope === "citizen" ? "citizen" : scope === "admin" ? "admin" : "agent";
  const { data } = await api.get(`/${safeScope}/requests/${encodeURIComponent(reference)}/replies/`, { params: cleanParams(params) });
  return unwrapList(data).map((event) => normalizeTimeline([event])[0]);
}

async function sendStaffRequestReply(scope, reference, payload = {}) {
  const safeScope = scope === "admin" ? "admin" : "agent";
  const form = new FormData();
  appendFormValue(form, "message", payload.message);
  (payload.images || []).forEach((file) => { if (file instanceof Blob) form.append("images", file); });
  (payload.image_captions || payload.imageCaptions || []).forEach((caption) => appendFormValue(form, "image_captions", caption));
  const { data } = await api.post(`/${safeScope}/requests/${encodeURIComponent(reference)}/replies/`, form);
  return normalizeTimeline([data])[0] || data;
}

export async function getCitizenRequestReplies(reference, params = {}) { return getRequestReplies("citizen", reference, params); }
export async function getAgentRequestReplies(reference, params = {}) { return getRequestReplies("agent", reference, params); }
export async function getAdminRequestReplies(reference, params = {}) { return getRequestReplies("admin", reference, params); }
export async function sendAgentRequestReply(reference, payload = {}) { return sendStaffRequestReply("agent", reference, payload); }
export async function sendAdminRequestReply(reference, payload = {}) { return sendStaffRequestReply("admin", reference, payload); }

export async function getCitizenRequestTimeline(reference, params = {}) {
  const { data } = await api.get(`/citizen/requests/${encodeURIComponent(reference)}/timeline/`, { params: cleanParams(params) });
  return unwrapList(data).map((event) => normalizeTimeline([event])[0]);
}

export async function updateCitizenReport(reference, changes = {}) {
  const form = new FormData();
  const keys = [
    "title", "description", "incident_category", "service", "location_text", "latitude", "longitude",
    "location_accuracy", "district", "street", "building", "landmark", "occurred_at", "frequency",
    "infrastructure_id", "severity", "danger_present", "people_affected", "impacts_accessibility",
    "accessibility_details", "allow_contact", "preferred_contact", "contact_phone",
  ];
  keys.forEach((key) => appendFormValue(form, key, changes[key], { allowEmpty: key === "service" }));
  (changes.images || []).forEach((file) => { if (file instanceof Blob) form.append("images", file); });
  (changes.image_captions || []).forEach((caption) => appendFormValue(form, "image_captions", caption));
  const { data } = await api.patch(`/citizen/reports/${encodeURIComponent(reference)}/`, form);
  return normalizeCitizen(data);
}

export async function cancelCitizenReport(reference, reason) {
  const form = new FormData();
  appendFormValue(form, "reason", reason);
  const { data } = await api.post(`/citizen/reports/${encodeURIComponent(reference)}/cancel/`, form);
  return normalizeCitizen(data);
}

export async function reopenCitizenReport(reference, reason) {
  const form = new FormData();
  appendFormValue(form, "reason", reason);
  const { data } = await api.post(`/citizen/reports/${encodeURIComponent(reference)}/reopen/`, form);
  return normalizeCitizen(data);
}

export async function addCitizenRequestMessage(reference, { message = "", images = [], imageCaptions = [] } = {}) {
  const form = new FormData();
  appendFormValue(form, "message", message);
  images.forEach((file) => { if (file instanceof Blob) form.append("images", file); });
  imageCaptions.forEach((caption) => appendFormValue(form, "image_captions", caption));
  const { data } = await api.post(`/citizen/reports/${encodeURIComponent(reference)}/messages/`, form);
  return normalizeTimeline([data])[0] || data;
}

export async function addRequestInformation(reference, message, images = []) {
  try {
    const event = await addCitizenRequestMessage(reference, { message, images });
    return { channel: "request", event };
  } catch (error) {
    if (![400, 404, 405].includes(error?.response?.status)) throw error;
    const [request, profile] = await Promise.all([getCitizenRequestById(reference), getProfile()]);
    const contact = await sendContactMessage({
      name: profile?.display_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Citoyen",
      email: profile?.email || "",
      service: Number(request.serviceId) || undefined,
      subject: `Complément — ${reference}`,
      message: `Information complémentaire liée à la demande ${reference} :\n\n${message}`,
    });
    return { channel: "contact", contact };
  }
}

export async function getCitizenReportAttachments(reference, params = {}) {
  const { data } = await api.get(`/citizen/reports/${encodeURIComponent(reference)}/attachments/`, { params: cleanParams(params) });
  return unwrapList(data).map((item, index) => normalizeAttachments([item])[0] || { ...item, id: index });
}

export async function addCitizenReportAttachments(reference, files = [], captions = []) {
  const form = new FormData();
  files.forEach((file) => { if (file instanceof Blob) form.append("images", file); });
  captions.forEach((caption) => appendFormValue(form, "image_captions", caption));
  const { data } = await api.post(`/citizen/reports/${encodeURIComponent(reference)}/attachments/`, form);
  return data;
}

export async function downloadRequestAttachment(attachment) {
  const path = attachment?.downloadUrl || attachment?.download_url;
  if (!path) throw new Error("Lien de téléchargement indisponible.");
  const apiOrigin = env.apiBaseUrl.replace(/\/api\/?$/i, "");
  const url = /^https?:/i.test(path) ? path : `${path.startsWith("/api/") ? apiOrigin : env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {} });
  if (!response.ok) {
    if (response.status === 403) throw new Error("Le fichier existe mais le backend n’autorise pas ce compte à le télécharger.");
    throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = attachment?.name || attachment?.original_name || "piece-jointe";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadCitizenReportAttachment(attachment) {
  return downloadRequestAttachment(attachment);
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
