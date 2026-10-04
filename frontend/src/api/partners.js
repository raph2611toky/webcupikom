import { api } from "./api.js";
import { unwrapList } from "./helpers.js";

function parseObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function boolFrom(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "oui", "available", "disponible", "open"].includes(normalized)) return true;
    if (["false", "0", "no", "non", "unavailable", "indisponible", "closed"].includes(normalized)) return false;
  }
  return fallback;
}

function nextActionFor(item, practicalInfo, isAvailable) {
  const explicit = practicalInfo.next_action || practicalInfo.nextAction || practicalInfo.action || "";
  if (explicit) return String(explicit);
  if (!isAvailable) return "Consulter les informations du partenaire ou revenir ultérieurement.";
  if (item.website) return "Consulter le site du partenaire";
  if (item.phone) return "Contacter le partenaire par téléphone";
  if (item.email) return "Contacter le partenaire par e-mail";
  return "Consulter les informations pratiques";
}

export function normalizePartner(item = {}) {
  const practicalInfo = parseObject(item.practical_info ?? item.practicalInfo, {});
  const statusValue = practicalInfo.available ?? practicalInfo.is_available ?? practicalInfo.status;
  const isAvailable = boolFrom(statusValue, true);
  return {
    ...item,
    id: item.id,
    slug: item.slug || String(item.id || ""),
    name: item.name || item.partner_name || "Service partenaire",
    partnerName: item.partner_name || item.partnerName || item.name || "Partenaire",
    category: item.category || "Service partenaire",
    description: item.description || "",
    address: item.address || "",
    district: item.district || "",
    openingHours: item.opening_hours || item.openingHours || "",
    phone: item.phone || "",
    email: item.email || "",
    website: item.website || "",
    practicalInfo,
    isAvailable,
    availabilityLabel: String(practicalInfo.availability_label || practicalInfo.status_label || (isAvailable ? "Disponible" : "Indisponible")),
    nextAction: nextActionFor(item, practicalInfo, isAvailable),
    isActive: item.is_active !== false,
    sortOrder: Number(item.sort_order ?? item.sortOrder ?? 0),
    updatedAt: item.updated_at || "",
  };
}

export async function getCitizenPartners({ search, category, district } = {}) {
  const { data } = await api.get("/city/locations/", {
    params: { partner: true, search, category, district },
    skipAccessToken: true,
  });
  return unwrapList(data).map(normalizePartner).sort((a, b) =>
    Number(a.isAvailable === false) - Number(b.isAvailable === false) ||
    a.sortOrder - b.sortOrder ||
    a.name.localeCompare(b.name)
  );
}

export async function getAdminPartners({ search } = {}) {
  const { data } = await api.get("/admin/locations/", { params: { kind: "partner", search } });
  return unwrapList(data).map(normalizePartner).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function toBackendPayload(payload = {}) {
  const currentPractical = parseObject(payload.practicalInfo ?? payload.practical_info, {});
  const practicalInfo = {
    ...currentPractical,
    available: payload.isAvailable !== false,
    availability_label: payload.isAvailable === false ? "Indisponible" : "Disponible",
    next_action: String(payload.nextAction || "").trim(),
  };
  return {
    name: String(payload.name || "").trim(),
    slug: payload.slug || undefined,
    kind: "partner",
    category: String(payload.category || "Service partenaire").trim(),
    description: String(payload.description || "").trim(),
    service: payload.service || null,
    partner_name: String(payload.partnerName || payload.partner_name || payload.name || "").trim(),
    address: String(payload.address || "").trim(),
    district: String(payload.district || "").trim(),
    opening_hours: String(payload.openingHours || payload.opening_hours || "").trim(),
    phone: String(payload.phone || "").trim(),
    email: String(payload.email || "").trim(),
    website: String(payload.website || "").trim(),
    practical_info: practicalInfo,
    transport_lines: [],
    timetable: [],
    is_active: payload.isActive !== false,
    sort_order: Number(payload.sortOrder ?? payload.sort_order ?? 0),
  };
}

export async function createAdminPartner(payload) {
  const { data } = await api.post("/admin/locations/", toBackendPayload(payload));
  return normalizePartner(data || {});
}

export async function updateAdminPartner(slug, payload) {
  const { data } = await api.patch(`/admin/locations/${encodeURIComponent(slug)}/`, toBackendPayload(payload));
  return normalizePartner(data || {});
}

export async function retireAdminPartner(slug) {
  await api.delete(`/admin/locations/${encodeURIComponent(slug)}/`);
  return true;
}
