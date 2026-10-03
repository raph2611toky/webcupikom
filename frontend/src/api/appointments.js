import { api } from "./api.js";
import { unwrapList } from "./helpers.js";

function toFormData(payload = {}) {
  const form = new FormData();
  Object.entries(payload).forEach(([key,value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, typeof value === "boolean" ? String(value) : value);
  });
  return form;
}

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([,value]) => value !== undefined && value !== null && value !== ""));
}

export function normalizeAppointmentSlot(item = {}) {
  const remaining = Number(item.remaining_capacity ?? Math.max(0, Number(item.capacity ?? 1) - Number(item.booked_count ?? 0)));
  const active = item.is_active !== false;
  const available = active && item.is_available !== false && remaining > 0;
  return {
    ...item,
    id: item.id,
    serviceId: item.service,
    serviceName: item.service_name || "Service municipal",
    agentId: item.agent ?? null,
    agentName: item.agent_name || "",
    date: item.date,
    startTime: String(item.start_time || "").slice(0,5),
    endTime: String(item.end_time || "").slice(0,5),
    time: String(item.start_time || "").slice(0,5),
    capacity: Number(item.capacity ?? 1),
    bookedCount: Number(item.booked_count ?? 0),
    remainingCapacity: remaining,
    isAvailable: available,
    isActive: active,
    state: !active ? "unavailable" : available ? "available" : "full",
    key: String(item.id ?? `${item.service}|${item.date}|${item.start_time}`),
  };
}

export function normalizeCitizenAppointment(item = {}) {
  return {
    ...item,
    id: item.id,
    reference: item.reference || String(item.id || ""),
    serviceId: item.service,
    serviceName: item.service_name || "Service municipal",
    serviceAddress: item.service_address || "",
    agentId: item.agent ?? null,
    agentName: item.agent_name || "Agent municipal",
    slotId: item.slot ?? null,
    date: item.date,
    startTime: String(item.start_time || "").slice(0,5),
    endTime: String(item.end_time || "").slice(0,5),
    time: String(item.start_time || "").slice(0,5),
    reason: item.reason || "",
    notes: item.notes || "",
    preferredLanguage: item.preferred_language || "",
    accessibilityNeeds: item.accessibility_needs || "",
    contactPhone: item.contact_phone || "",
    status: item.status || "pending",
    cancellationReason: item.cancellation_reason || "",
    canCancel: item.can_cancel !== false,
    canReschedule: item.can_reschedule !== false,
    createdAt: item.created_at || "",
    updatedAt: item.updated_at || "",
  };
}

export function normalizeAgentAppointment(item = {}) {
  return {
    ...normalizeCitizenAppointment(item),
    citizenId: item.citizen,
    citizenName: item.citizen_name || "Citoyen",
    citizenEmail: item.citizen_email || "",
    citizenPhone: item.citizen_phone || "",
    citizenAddress: item.citizen_address || "",
    assignedTo: item.assigned_to ?? null,
    assignedToName: item.assigned_to_name || "",
    internalNotes: item.internal_notes || "",
  };
}

export function normalizeAppointmentEvent(item = {}) {
  return {
    ...item,
    id: item.id,
    title: item.title || "Mise à jour",
    message: item.message || "",
    eventType: item.event_type || "note",
    isPublic: item.is_public !== false,
    createdBy: item.created_by ?? null,
    createdByName: item.created_by_name || "",
    createdAt: item.created_at || "",
  };
}

/* ------------------------------ Citizen ------------------------------ */
export async function getCitizenAppointments(params = {}) {
  const { data } = await api.get("/citizen/appointments/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeCitizenAppointment);
}

export async function getCitizenAppointmentAvailability(params = {}) {
  const { data } = await api.get("/citizen/appointments/availability/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeAppointmentSlot);
}

export async function getCitizenUpcomingAppointments() {
  const { data } = await api.get("/citizen/appointments/upcoming/");
  return unwrapList(data).map(normalizeCitizenAppointment);
}

export async function getCitizenAppointmentHistory() {
  const { data } = await api.get("/citizen/appointments/history/");
  return unwrapList(data).map(normalizeCitizenAppointment);
}

export async function getCitizenAppointment(reference) {
  const { data } = await api.get(`/citizen/appointments/${encodeURIComponent(reference)}/`);
  return normalizeCitizenAppointment(data);
}

export async function createCitizenAppointment(payload) {
  const { data } = await api.post("/citizen/appointments/", toFormData({
    service: payload.service ?? payload.serviceId,
    slot: payload.slot ?? payload.slotId,
    reason: payload.reason,
    notes: payload.notes,
    preferred_language: payload.preferred_language ?? payload.preferredLanguage,
    accessibility_needs: payload.accessibility_needs ?? payload.accessibilityNeeds,
    contact_phone: payload.contact_phone ?? payload.contactPhone,
  }));
  return normalizeCitizenAppointment(data);
}

export async function updateCitizenAppointment(reference, payload = {}) {
  const { data } = await api.patch(`/citizen/appointments/${encodeURIComponent(reference)}/`, toFormData({
    slot: payload.slot ?? payload.slotId,
    reason: payload.reason,
    notes: payload.notes,
    preferred_language: payload.preferred_language ?? payload.preferredLanguage,
    accessibility_needs: payload.accessibility_needs ?? payload.accessibilityNeeds,
    contact_phone: payload.contact_phone ?? payload.contactPhone,
  }));
  return normalizeCitizenAppointment(data);
}

export async function cancelCitizenAppointment(reference, reason = "") {
  const config = reason ? { data: toFormData({ reason }) } : undefined;
  await api.delete(`/citizen/appointments/${encodeURIComponent(reference)}/`, config);
  return true;
}

export async function getCitizenAppointmentTimeline(reference) {
  const { data } = await api.get(`/citizen/appointments/${encodeURIComponent(reference)}/timeline/`);
  return unwrapList(data).map(normalizeAppointmentEvent);
}

/* ------------------------------- Agent ------------------------------- */
export async function getAgentAppointments(params = {}) {
  const { data } = await api.get("/agent/appointments/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeAgentAppointment);
}

export async function getAgentAppointmentSummary() {
  const { data } = await api.get("/agent/appointments/summary/");
  return data || {};
}

export async function getAgentAppointment(reference) {
  const { data } = await api.get(`/agent/appointments/${encodeURIComponent(reference)}/`);
  return normalizeAgentAppointment(data);
}

export async function updateAgentAppointment(reference, payload = {}) {
  const { data } = await api.patch(`/agent/appointments/${encodeURIComponent(reference)}/`, toFormData({
    status: payload.status,
    slot: payload.slot ?? payload.slotId,
    assigned_to: payload.assigned_to ?? payload.assignedTo,
    internal_notes: payload.internal_notes ?? payload.internalNotes,
    public_message: payload.public_message ?? payload.publicMessage,
    cancellation_reason: payload.cancellation_reason ?? payload.cancellationReason,
  }));
  return normalizeAgentAppointment(data);
}

export async function getAgentAppointmentTimeline(reference) {
  const { data } = await api.get(`/agent/appointments/${encodeURIComponent(reference)}/timeline/`);
  return unwrapList(data).map(normalizeAppointmentEvent);
}

export async function addAgentAppointmentEvent(reference, payload = {}) {
  const { data } = await api.post(`/agent/appointments/${encodeURIComponent(reference)}/timeline/`, toFormData({
    title: payload.title,
    message: payload.message,
    is_public: payload.is_public ?? payload.isPublic,
  }));
  return normalizeAppointmentEvent(data);
}

export async function getAgentAppointmentSlots(params = {}) {
  const { data } = await api.get("/agent/appointment-slots/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeAppointmentSlot);
}

export async function createAgentAppointmentSlot(payload = {}) {
  const { data } = await api.post("/agent/appointment-slots/", toFormData({
    service: payload.service ?? payload.serviceId,
    date: payload.date,
    start_time: payload.start_time ?? payload.startTime,
    end_time: payload.end_time ?? payload.endTime,
    capacity: payload.capacity,
  }));
  return normalizeAppointmentSlot(data);
}

export async function getAgentAppointmentSlot(id) {
  const { data } = await api.get(`/agent/appointment-slots/${encodeURIComponent(id)}/`);
  return normalizeAppointmentSlot(data);
}

export async function updateAgentAppointmentSlot(id, payload = {}) {
  const { data } = await api.patch(`/agent/appointment-slots/${encodeURIComponent(id)}/`, toFormData({
    date: payload.date,
    start_time: payload.start_time ?? payload.startTime,
    end_time: payload.end_time ?? payload.endTime,
    capacity: payload.capacity,
    is_active: payload.is_active ?? payload.isActive,
  }));
  return normalizeAppointmentSlot(data);
}

export async function disableAgentAppointmentSlot(id) {
  await api.delete(`/agent/appointment-slots/${encodeURIComponent(id)}/`);
  return true;
}

/* ------------------------------- Admin ------------------------------- */
export async function getAdminAppointments(params = {}) {
  const { data } = await api.get("/admin/appointments/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeAgentAppointment);
}

export async function createAdminAppointment(payload = {}) {
  const { data } = await api.post("/admin/appointments/", toFormData({
    citizen: payload.citizen ?? payload.citizenId,
    service: payload.service ?? payload.serviceId,
    slot: payload.slot ?? payload.slotId,
    assigned_to: payload.assigned_to ?? payload.assignedTo,
    reason: payload.reason,
    notes: payload.notes,
  }));
  return normalizeAgentAppointment(data);
}

export async function getAdminAppointmentSummary() {
  const { data } = await api.get("/admin/appointments/summary/");
  return data || {};
}

export async function getAdminAppointment(reference) {
  const { data } = await api.get(`/admin/appointments/${encodeURIComponent(reference)}/`);
  return normalizeAgentAppointment(data);
}

export async function updateAdminAppointment(reference, payload = {}) {
  const { data } = await api.patch(`/admin/appointments/${encodeURIComponent(reference)}/`, toFormData({
    status: payload.status,
    slot: payload.slot ?? payload.slotId,
    assigned_to: payload.assigned_to ?? payload.assignedTo,
    reason: payload.reason,
    internal_notes: payload.internal_notes ?? payload.internalNotes,
    public_message: payload.public_message ?? payload.publicMessage,
    cancellation_reason: payload.cancellation_reason ?? payload.cancellationReason,
  }));
  return normalizeAgentAppointment(data);
}

export async function getAdminAppointmentTimeline(reference) {
  const { data } = await api.get(`/admin/appointments/${encodeURIComponent(reference)}/timeline/`);
  return unwrapList(data).map(normalizeAppointmentEvent);
}

export async function addAdminAppointmentEvent(reference, payload = {}) {
  const { data } = await api.post(`/admin/appointments/${encodeURIComponent(reference)}/timeline/`, toFormData({
    title: payload.title,
    message: payload.message,
    is_public: payload.is_public ?? payload.isPublic,
  }));
  return normalizeAppointmentEvent(data);
}

export async function getAdminAppointmentSlots(params = {}) {
  const { data } = await api.get("/admin/appointment-slots/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeAppointmentSlot);
}

export async function createAdminAppointmentSlot(payload = {}) {
  const { data } = await api.post("/admin/appointment-slots/", toFormData({
    service: payload.service ?? payload.serviceId,
    agent: payload.agent ?? payload.agentId,
    date: payload.date,
    start_time: payload.start_time ?? payload.startTime,
    end_time: payload.end_time ?? payload.endTime,
    capacity: payload.capacity,
    is_active: payload.is_active ?? payload.isActive,
  }));
  return normalizeAppointmentSlot(data);
}

export async function getAdminAppointmentSlot(id) {
  const { data } = await api.get(`/admin/appointment-slots/${encodeURIComponent(id)}/`);
  return normalizeAppointmentSlot(data);
}

export async function updateAdminAppointmentSlot(id, payload = {}) {
  const { data } = await api.patch(`/admin/appointment-slots/${encodeURIComponent(id)}/`, toFormData({
    service: payload.service ?? payload.serviceId,
    agent: payload.agent ?? payload.agentId,
    date: payload.date,
    start_time: payload.start_time ?? payload.startTime,
    end_time: payload.end_time ?? payload.endTime,
    capacity: payload.capacity,
    is_active: payload.is_active ?? payload.isActive,
  }));
  return normalizeAppointmentSlot(data);
}

export async function disableAdminAppointmentSlot(id) {
  await api.delete(`/admin/appointment-slots/${encodeURIComponent(id)}/`);
  return true;
}

export function getAppointmentStatusLabel(status) {
  return ({
    pending:"En attente",
    confirmed:"Confirmé",
    completed:"Terminé",
    cancelled:"Annulé",
    rejected:"Refusé",
    no_show:"Absent",
  })[status] || status || "—";
}

export function getSlotStatusLabel(state) {
  return ({
    available:"Disponible",
    full:"Complet",
    unavailable:"Indisponible",
  })[state] || state || "—";
}
