import { api } from "./api.js";
import { unwrapList } from "./helpers.js";

function toFormData(payload = {}) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, typeof value === "boolean" ? String(value) : value);
  });
  return form;
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function pad(value) { return String(value).padStart(2, "0"); }
function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function localTimeKey(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.busy)) return data.busy;
  if (Array.isArray(data?.busy_times)) return data.busy_times;
  if (Array.isArray(data?.booked)) return data.booked;
  if (Array.isArray(data?.unavailable)) return data.unavailable;
  if (Array.isArray(data?.unavailable_times)) return data.unavailable_times;
  if (Array.isArray(data?.slots)) return data.slots;
  if (Array.isArray(data?.times)) return data.times;
  return [];
}

function resolveAppointment(data) {
  if (data?.appointment && typeof data.appointment === "object") return data.appointment;
  if (data?.data && !Array.isArray(data.data) && typeof data.data === "object") return data.data;
  return data || {};
}

function textValue(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return fallback;
}

function normalizeSlotText(slot, start, end) {
  if (typeof slot === "string" || typeof slot === "number") return String(slot);
  if (slot && typeof slot === "object") {
    const slotStart = parseDateTime(slot.starts_at || slot.start_at || slot.start);
    const slotEnd = parseDateTime(slot.ends_at || slot.end_at || slot.end);
    const resolvedStart = slotStart || start;
    const resolvedEnd = slotEnd || end;
    if (resolvedStart && resolvedEnd) return `${localTimeKey(resolvedStart)} - ${localTimeKey(resolvedEnd)}`;
    if (resolvedStart) return localTimeKey(resolvedStart);
    if (slot.label || slot.display || slot.text) return String(slot.label || slot.display || slot.text);
  }
  if (start && end) return `${localTimeKey(start)} - ${localTimeKey(end)}`;
  return "";
}

export function normalizeCitizenAppointment(item = {}) {
  const slotObject = item.slot && typeof item.slot === "object" ? item.slot : null;
  const start = parseDateTime(item.starts_at || item.start_at || item.start || slotObject?.starts_at || slotObject?.start_at || slotObject?.start);
  const end = parseDateTime(item.ends_at || item.end_at || item.end || slotObject?.ends_at || slotObject?.end_at || slotObject?.end);
  const preparationValue = item.preparation && typeof item.preparation === "object"
    ? (item.preparation.instructions || item.preparation.text || item.preparation.label || "")
    : item.preparation;
  return {
    ...item,
    id: item.id,
    reference: item.reference || String(item.id || ""),
    serviceId: item.service?.id ?? item.service ?? null,
    serviceName: item.service_name || item.service?.name || "Service municipal",
    serviceAddress: item.location || item.service_address || "",
    agentId: item.agent?.id ?? item.agent ?? null,
    agentName: item.agent_name || item.agent?.display_name || item.agent?.name || "Agent municipal",
    startsAt: item.starts_at || item.start_at || item.start || slotObject?.starts_at || slotObject?.start_at || slotObject?.start || "",
    endsAt: item.ends_at || item.end_at || item.end || slotObject?.ends_at || slotObject?.end_at || slotObject?.end || "",
    date: start ? localDateKey(start) : "",
    startTime: start ? localTimeKey(start) : "",
    endTime: end ? localTimeKey(end) : "",
    time: start ? localTimeKey(start) : "",
    reason: item.reason || "",
    notes: item.details || item.notes || "",
    details: item.details || "",
    location: textValue(item.location, textValue(item.location?.label || item.location?.name, "")),
    preparationInstructions: item.preparation_instructions || "",
    preparationDocuments: item.preparation_documents || "",
    reminderEnabled: item.reminder_enabled !== false,
    reminderMinutesBefore: Number(item.reminder_minutes_before ?? 60),
    status: item.status || "requested",
    statusLabel: item.status_label || "",
    slot: normalizeSlotText(item.slot, start, end),
    preparation: textValue(preparationValue, textValue(item.preparation_instructions, "")),
    canCancel: typeof item.can_cancel === "boolean" ? item.can_cancel : String(item.can_cancel || "").toLowerCase() === "true" ? true : ["requested", "confirmed"].includes(item.status || "requested"),
    canReschedule: false,
    createdAt: item.created_at || "",
    updatedAt: item.updated_at || "",
  };
}

export function normalizeAgentAppointment(item = {}) {
  return {
    ...normalizeCitizenAppointment(item),
    citizenId: item.citizen?.id ?? item.citizen ?? null,
    citizenName: item.citizen_name || item.citizen?.display_name || "Citoyen",
    citizenEmail: item.citizen_email || "",
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
    createdAt: item.created_at || "",
  };
}

export async function getCitizenAppointmentAgents() {
  const { data } = await api.get("/citizen/appointments/agents/");
  return unwrapList(data).map((item) => ({
    ...item,
    id: item.id,
    name: item.display_name || item.name || `Agent ${item.id}`,
  }));
}

function busyInterval(entry, date) {
  if (!entry) return null;
  if (typeof entry === "string") {
    if (/^\d{2}:\d{2}/.test(entry)) {
      const start = new Date(`${date}T${entry.slice(0, 5)}:00`);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return { start, end };
    }
    const start = parseDateTime(entry);
    return start ? { start, end: new Date(start.getTime() + 30 * 60 * 1000) } : null;
  }
  const startValue = entry.starts_at || entry.start_at || entry.start || entry.from || entry.datetime;
  const endValue = entry.ends_at || entry.end_at || entry.end || entry.to;
  let start = parseDateTime(startValue);
  let end = parseDateTime(endValue);
  if (!start && typeof entry.time === "string") start = new Date(`${date}T${entry.time.slice(0, 5)}:00`);
  if (!start && typeof entry.start_time === "string") start = new Date(`${date}T${entry.start_time.slice(0, 5)}:00`);
  if (!end && typeof entry.end_time === "string") end = new Date(`${date}T${entry.end_time.slice(0, 5)}:00`);
  if (start && !end) end = new Date(start.getTime() + 30 * 60 * 1000);
  return start && end ? { start, end } : null;
}

function buildCandidateSlots({ date, agent, agentName, busyRows }) {
  const busy = resolveList(busyRows).map((row) => busyInterval(row, date)).filter(Boolean);
  const now = new Date();
  const slots = [];
  const ranges = [[8, 12], [13, 17]];
  for (const [from, to] of ranges) {
    for (let minutes = from * 60; minutes < to * 60; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const start = new Date(`${date}T${pad(hour)}:${pad(minute)}:00`);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const isPast = end <= now;
      const isBusy = busy.some((row) => start < row.end && end > row.start);
      slots.push({
        id: `${agent}|${date}|${pad(hour)}:${pad(minute)}`,
        agentId: agent,
        agentName: agentName || "Agent municipal",
        date,
        startTime: localTimeKey(start),
        endTime: localTimeKey(end),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        isAvailable: !isPast && !isBusy,
        state: !isPast && !isBusy ? "available" : "full",
      });
    }
  }
  return slots;
}

/* ------------------------------ Citizen ------------------------------ */
export async function getCitizenAppointmentsPage(params = {}) {
  const { data } = await api.get("/citizen/appointments/", {
    params: cleanParams(params),
  });
  const rows = unwrapList(data).map(normalizeCitizenAppointment);
  return {
    count: Number(data?.count ?? rows.length),
    next: data?.next || null,
    previous: data?.previous || null,
    results: rows,
  };
}

export async function getCitizenAppointments(params = {}) {
  return (await getCitizenAppointmentsPage(params)).results;
}

export async function getAllCitizenAppointments(params = {}) {
  const pageSize = Number(params.page_size ?? 100);
  const rows = [];
  const seen = new Set();
  let page = Number(params.page ?? 1);
  let expectedCount = null;

  for (let guard = 0; guard < 100; guard += 1) {
    const result = await getCitizenAppointmentsPage({ ...params, page, page_size: pageSize });
    if (expectedCount === null && Number.isFinite(result.count)) expectedCount = result.count;

    let added = 0;
    result.results.forEach((item, index) => {
      const key = item.reference || item.id || `${page}-${index}-${item.startsAt || item.date || "appointment"}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(item);
      added += 1;
    });

    if (!result.results.length || added === 0) break;
    if (expectedCount !== null && rows.length >= expectedCount) break;
    if (!result.next && result.results.length < pageSize) break;
    page += 1;
  }

  return rows;
}

export async function getCitizenAppointmentAvailability({ agent, date, agentName = "" } = {}) {
  if (!agent || !date) return [];
  const { data } = await api.get("/citizen/appointments/availability/", {
    params: cleanParams({ agent, date }),
  });
  return buildCandidateSlots({ date, agent, agentName, busyRows: data });
}

export async function getCitizenUpcomingAppointments() {
  const rows = await getCitizenAppointments();
  const now = Date.now();
  return rows
    .filter((item) => {
      const start = parseDateTime(item.startsAt)?.getTime() ?? 0;
      return start >= now && !["cancelled", "declined", "completed"].includes(item.status);
    })
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

export async function getCitizenAppointmentHistory() {
  const rows = await getCitizenAppointments();
  const now = Date.now();
  return rows
    .filter((item) => {
      const start = parseDateTime(item.startsAt)?.getTime() ?? 0;
      return start < now || ["cancelled", "declined", "completed"].includes(item.status);
    })
    .sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)));
}

export async function getCitizenAppointment(reference) {
  const { data } = await api.get(`/citizen/appointments/${encodeURIComponent(reference)}/`);
  return normalizeCitizenAppointment(resolveAppointment(data));
}

export async function createCitizenAppointment(payload = {}) {
  const { data } = await api.post("/citizen/appointments/", toFormData({
    agent: payload.agent ?? payload.agentId,
    service: payload.service ?? payload.serviceId,
    starts_at: payload.starts_at ?? payload.startsAt,
    ends_at: payload.ends_at ?? payload.endsAt,
    reason: payload.reason,
    details: payload.details ?? payload.notes,
    reminder_enabled: payload.reminder_enabled ?? payload.reminderEnabled ?? true,
    reminder_minutes_before: payload.reminder_minutes_before ?? payload.reminderMinutesBefore ?? 60,
  }));
  return normalizeCitizenAppointment(resolveAppointment(data));
}

export async function updateCitizenAppointment(reference, payload = {}) {
  const { data } = await api.patch(`/citizen/appointments/${encodeURIComponent(reference)}/`, toFormData({
    status: payload.status,
    reminder_enabled: payload.reminder_enabled ?? payload.reminderEnabled,
    reminder_minutes_before: payload.reminder_minutes_before ?? payload.reminderMinutesBefore,
  }));
  return normalizeCitizenAppointment(resolveAppointment(data));
}

export async function cancelCitizenAppointment(reference) {
  await updateCitizenAppointment(reference, { status: "cancelled" });
  return true;
}

export async function getCitizenAppointmentTimeline() {
  return [];
}

/* ------------------------------- Agent ------------------------------- */
export async function getAgentAppointments(params = {}) {
  const { data } = await api.get("/agent/appointments/", { params: cleanParams(params) });
  return unwrapList(data).map(normalizeAgentAppointment);
}

export async function getAgentAppointmentSummary() {
  const rows = await getAgentAppointments();
  const today = localDateKey(new Date());
  return {
    total: rows.length,
    today: rows.filter((item) => item.date === today).length,
    requested: rows.filter((item) => item.status === "requested").length,
    pending: rows.filter((item) => item.status === "requested").length,
    confirmed: rows.filter((item) => item.status === "confirmed").length,
    completed: rows.filter((item) => item.status === "completed").length,
    cancelled: rows.filter((item) => item.status === "cancelled").length,
    declined: rows.filter((item) => item.status === "declined").length,
    upcoming: rows.filter((item) => ["requested", "confirmed"].includes(item.status) && (parseDateTime(item.startsAt)?.getTime() ?? 0) >= Date.now()).length,
  };
}

export async function getAgentAppointment(reference) {
  const { data } = await api.get(`/agent/appointments/${encodeURIComponent(reference)}/`);
  return normalizeAgentAppointment(resolveAppointment(data));
}

export async function updateAgentAppointment(reference, payload = {}) {
  const { data } = await api.patch(`/agent/appointments/${encodeURIComponent(reference)}/`, toFormData({
    status: payload.status,
    starts_at: payload.starts_at ?? payload.startsAt,
    ends_at: payload.ends_at ?? payload.endsAt,
    location: payload.location,
    preparation_instructions: payload.preparation_instructions ?? payload.preparationInstructions,
  }));
  return normalizeAgentAppointment(resolveAppointment(data));
}

export async function getAgentAppointmentTimeline() { return []; }
export async function addAgentAppointmentEvent() {
  throw new Error("Le backend actuel ne fournit pas de timeline dédiée aux rendez-vous.");
}

/* ------------------------------- Admin ------------------------------- */
export async function getAdminAppointments() {
  const { data } = await api.get("/admin/appointments/");
  return unwrapList(data).map(normalizeAgentAppointment);
}

export async function getAdminAppointmentSummary() {
  const rows = await getAdminAppointments();
  const today = localDateKey(new Date());
  return {
    total: rows.length,
    today: rows.filter((item) => item.date === today).length,
    requested: rows.filter((item) => item.status === "requested").length,
    pending: rows.filter((item) => item.status === "requested").length,
    confirmed: rows.filter((item) => item.status === "confirmed").length,
    completed: rows.filter((item) => item.status === "completed").length,
    cancelled: rows.filter((item) => item.status === "cancelled").length,
    declined: rows.filter((item) => item.status === "declined").length,
    upcoming: rows.filter((item) => ["requested", "confirmed"].includes(item.status) && (parseDateTime(item.startsAt)?.getTime() ?? 0) >= Date.now()).length,
  };
}

export async function getAdminAppointment(reference) {
  const { data } = await api.get(`/admin/appointments/${encodeURIComponent(reference)}/`);
  return normalizeAgentAppointment(resolveAppointment(data));
}

export async function updateAdminAppointment(reference, payload = {}) {
  const { data } = await api.patch(`/admin/appointments/${encodeURIComponent(reference)}/`, toFormData({
    status: payload.status,
    starts_at: payload.starts_at ?? payload.startsAt,
    ends_at: payload.ends_at ?? payload.endsAt,
    location: payload.location,
    preparation_instructions: payload.preparation_instructions ?? payload.preparationInstructions,
  }));
  return normalizeAgentAppointment(resolveAppointment(data));
}

export async function getAdminAppointmentTimeline() { return []; }
export async function addAdminAppointmentEvent() {
  throw new Error("Le backend actuel ne fournit pas de timeline dédiée aux rendez-vous.");
}

export function getAppointmentStatusLabel(status) {
  return ({
    requested: "En attente",
    confirmed: "Confirmé",
    completed: "Terminé",
    cancelled: "Annulé",
    declined: "Refusé",
    pending: "En attente",
    rejected: "Refusé",
  })[status] || status || "—";
}

export function getSlotStatusLabel(state) {
  return ({ available: "Disponible", full: "Occupé", unavailable: "Indisponible" })[state] || state || "—";
}
