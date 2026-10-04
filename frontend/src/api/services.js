import { api } from "./api.js";
import { services as presentationServices } from "../data/services.js";
import { unwrapList } from "./helpers.js";
import { SERVICE_TRANSLATIONS } from "../data/serviceTranslations.js";
import { getLocale } from "../utils/i18n.js";
import { cachedRequest, invalidateCache } from "./cache.js";

const presentationBySlug = new Map(presentationServices.map((item) => [item.slug, item]));

function parseMaybeJson(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function parseList(value, fallback = []) {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.items)) return parsed.items;
    return Object.values(parsed).filter((entry) => typeof entry === "string" || typeof entry === "number");
  }
  if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
  return fallback;
}

function parseObject(value, fallback = {}) {
  const parsed = parseMaybeJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
}

function parseAvailability(item = {}) {
  const raw = parseMaybeJson(item.availability);
  const object = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawText = typeof raw === "string" ? raw.trim() : "";
  const text = rawText.toLowerCase();

  let isAvailable;
  const candidate = object.is_available ?? object.available ?? object.isAvailable ?? object.active;
  if (typeof candidate === "boolean") isAvailable = candidate;
  else if (["false", "0", "no", "non"].includes(String(candidate).toLowerCase())) isAvailable = false;
  else if (["true", "1", "yes", "oui"].includes(String(candidate).toLowerCase())) isAvailable = true;

  if (isAvailable === undefined && rawText) {
    if (/indispon|unavailable|offline|maintenance|interromp|incident|hors.?service|down/.test(text)) isAvailable = false;
    else if (/disponible|available|online|opérationnel|operationnel|active|actif/.test(text)) isAvailable = true;
  }
  if (isAvailable === undefined && typeof item.is_available === "boolean") isAvailable = item.is_available;
  if (isAvailable === undefined && typeof item.is_active === "boolean") isAvailable = item.is_active;
  if (isAvailable === undefined) isAvailable = true;

  const reason = object.reason ?? object.unavailability_reason ?? item.unavailability_reason ?? "";
  const alternativeAction = object.alternative_action ?? object.alternativeAction ?? item.alternative_action ?? "";
  const unavailableSince = object.unavailable_since ?? object.unavailableSince ?? item.unavailable_since ?? "";
  const expectedRestoreAt = object.expected_restore_at ?? object.expectedRestoreAt ?? item.expected_restore_at ?? "";
  const updatedAt = object.updated_at ?? object.availability_updated_at ?? item.availability_updated_at ?? item.updated_at ?? "";
  const label = object.label ?? object.status_label ?? object.statusLabel ?? (isAvailable ? "Disponible" : "Indisponible");

  return {
    isAvailable,
    label,
    reason: String(reason || ""),
    alternativeAction: String(alternativeAction || ""),
    unavailableSince: unavailableSince || "",
    expectedRestoreAt: expectedRestoreAt || "",
    updatedAt: updatedAt || "",
    raw,
  };
}

export function normalizeService(item = {}) {
  const presentation = presentationBySlug.get(item.slug) || {};
  const availability = parseAvailability(item);
  const base = {
    ...presentation,
    ...item,
    id: item.id ?? presentation.id,
    slug: item.slug ?? presentation.slug,
    name: item.name ?? presentation.name ?? "Service municipal",
    category: item.category ?? presentation.category ?? "Administration",
    shortDescription: item.short_description ?? item.shortDescription ?? presentation.shortDescription ?? "",
    description: item.description ?? presentation.description ?? "",
    openingHours: item.opening_hours ?? item.openingHours ?? presentation.openingHours ?? "",
    phone: item.phone ?? presentation.phone ?? "",
    email: item.email ?? presentation.email ?? "",
    address: item.address ?? presentation.address ?? "",
    icon: presentation.icon || item.icon || "◇",
    actions: parseList(item.actions ?? presentation.actions, []),
    requiredDocuments: parseList(item.required_documents ?? item.requiredDocuments ?? presentation.requiredDocuments, []),
    faq: parseList(item.faq ?? presentation.faq, []),
    translations: parseObject(item.translations, {}),
    published: item.is_active !== false,
    is_active: item.is_active !== false,
    isFeatured: Boolean(item.is_featured ?? item.isFeatured ?? false),
    priorityOrder: Number(item.priority_order ?? item.priorityOrder ?? 0),
    usageCount: Number(item.usage_count ?? item.usageCount ?? 0),
    sortOrder: Number(item.sort_order ?? item.sortOrder ?? presentation.sortOrder ?? 999),
    availability,
    isAvailable: availability.isAvailable,
    availabilityLabel: availability.label,
    unavailabilityReason: availability.reason,
    alternativeAction: availability.alternativeAction,
    unavailableSince: availability.unavailableSince,
    expectedRestoreAt: availability.expectedRestoreAt,
    availabilityUpdatedAt: availability.updatedAt,
  };
  const locale = getLocale();
  const translation = locale === "fr" ? null : SERVICE_TRANSLATIONS[base.slug]?.[locale];
  return translation ? {
    ...base,
    ...translation,
    openingHours: base.openingHours,
    phone: base.phone,
    email: base.email,
    address: base.address,
    availability: base.availability,
    isAvailable: base.isAvailable,
    availabilityLabel: base.availabilityLabel,
    unavailabilityReason: base.unavailabilityReason,
    alternativeAction: base.alternativeAction,
    expectedRestoreAt: base.expectedRestoreAt,
  } : base;
}

function sortRows(items) {
  return [...items].sort((a,b) =>
    Number(a.isAvailable === false) - Number(b.isAvailable === false) ||
    (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
    String(a.name).localeCompare(String(b.name))
  );
}

export async function getServices({ publishedOnly = true, force = false } = {}) {
  const endpoint = publishedOnly ? "/city/services/" : "/admin/services/";
  const load = async () => {
    const { data } = await api.get(endpoint, publishedOnly ? { skipAccessToken: true } : {});
    return sortRows(unwrapList(data).map(normalizeService));
  };
  if (!publishedOnly || force) return load();
  // La disponibilité peut changer rapidement : cache volontairement court.
  return cachedRequest(`services:list:${getLocale()}`, load, { ttl: 30_000 });
}

export async function getService(slug, { includeDrafts = false, force = false } = {}) {
  const endpoint = includeDrafts
    ? `/admin/services/${encodeURIComponent(slug)}/`
    : `/city/services/${encodeURIComponent(slug)}/`;
  const load = async () => {
    const { data } = await api.get(endpoint, includeDrafts ? {} : { skipAccessToken: true });
    return normalizeService(data);
  };
  if (includeDrafts || force) return load();
  return cachedRequest(`services:item:${getLocale()}:${slug}`, load, { ttl: 30_000 });
}

function appendForm(form, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === "object") form.append(key, JSON.stringify(value));
  else form.append(key, String(value));
}

function toBackendFormData(payload) {
  const form = new FormData();
  appendForm(form, "name", payload.name ?? "");
  if (payload.slug) appendForm(form, "slug", payload.slug);
  appendForm(form, "category", payload.category ?? "");
  appendForm(form, "short_description", payload.shortDescription ?? payload.short_description ?? "");
  appendForm(form, "description", payload.description ?? "");
  appendForm(form, "opening_hours", payload.openingHours ?? payload.opening_hours ?? "");
  appendForm(form, "phone", payload.phone ?? "");
  appendForm(form, "email", payload.email ?? "");
  appendForm(form, "address", payload.address ?? "");
  appendForm(form, "actions", payload.actions ?? []);
  appendForm(form, "required_documents", payload.requiredDocuments ?? payload.required_documents ?? []);
  appendForm(form, "faq", payload.faq ?? []);
  appendForm(form, "translations", payload.translations ?? {});
  appendForm(form, "is_featured", Boolean(payload.isFeatured ?? payload.is_featured ?? false));
  appendForm(form, "priority_order", Number(payload.priorityOrder ?? payload.priority_order ?? 0));
  appendForm(form, "is_active", payload.published ?? payload.is_active ?? true);
  appendForm(form, "sort_order", Number(payload.sortOrder ?? payload.sort_order ?? 0));
  return form;
}

export async function createService(payload) {
  const { data } = await api.post("/admin/services/", toBackendFormData(payload));
  invalidateCache("services:");
  return normalizeService(data);
}

async function resolveAdminService(idOrSlug) {
  const rows = await getServices({ publishedOnly: false });
  return rows.find((item) =>
    String(item.id) === String(idOrSlug) ||
    String(item.slug) === String(idOrSlug)
  ) || null;
}

export async function updateService(idOrSlug, patch) {
  const current = await resolveAdminService(idOrSlug);
  if (!current) throw new Error("Service introuvable.");
  const payload = { ...current, ...patch };
  const { data } = await api.patch(`/admin/services/${encodeURIComponent(current.slug)}/`, toBackendFormData(payload));
  invalidateCache("services:");
  return normalizeService(data);
}

export async function deleteService(idOrSlug) {
  const current = await resolveAdminService(idOrSlug);
  if (!current) return false;
  await api.delete(`/admin/services/${encodeURIComponent(current.slug)}/`);
  invalidateCache("services:");
  return true;
}

function availabilityForm(payload = {}) {
  const form = new FormData();
  form.append("is_available", payload.isAvailable === false || payload.is_available === false ? "false" : "true");
  form.append("reason", String(payload.reason ?? payload.unavailabilityReason ?? ""));
  form.append("alternative_action", String(payload.alternativeAction ?? payload.alternative_action ?? ""));
  if (payload.expectedRestoreAt ?? payload.expected_restore_at) {
    form.append("expected_restore_at", String(payload.expectedRestoreAt ?? payload.expected_restore_at));
  } else {
    form.append("expected_restore_at", "");
  }
  return form;
}

export async function updateServiceAvailability(slug, payload, { role = "agent" } = {}) {
  const namespace = role === "admin" ? "admin" : "agent";
  const { data } = await api.patch(`/${namespace}/services/${encodeURIComponent(slug)}/availability/`, availabilityForm(payload));
  invalidateCache("services:");
  return normalizeService(data);
}

export async function getServiceHighlights({ limit = 4, force = false } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 4, 1), 20);
  const load = async () => {
    const { data } = await api.get("/city/services/highlights/", {
      params: { limit: safeLimit },
      skipAccessToken: true,
    });
    return {
      featured: (Array.isArray(data?.featured) ? data.featured : []).map(normalizeService),
      popular: (Array.isArray(data?.popular) ? data.popular : []).map(normalizeService),
    };
  };
  if (force) return load();
  return cachedRequest(`services:highlights:${getLocale()}:${safeLimit}`, load, { ttl: 60_000 });
}

export async function getServiceCategories() {
  const items = await getServices();
  return ["Tous", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
}

// F76 — Avis citoyen sur un service après usage vérifié.
export async function getServiceFeedbackState(slug) {
  const { data } = await api.get(`/citizen/services/${encodeURIComponent(slug)}/feedback/`);
  return {
    eligible: Boolean(data?.eligible),
    canCreate: Boolean(data?.can_create),
    canUpdate: Boolean(data?.can_update),
    eligibilityReason: String(data?.eligibility_reason || ""),
    eligibleSources: Array.isArray(data?.eligible_sources) ? data.eligible_sources : [],
    feedback: data?.feedback || null,
  };
}

export async function saveServiceFeedback(slug, payload, { update = false } = {}) {
  const body = {
    rating: Number(payload.rating),
    comment: String(payload.comment || "").trim(),
  };
  if (payload.requestReference) body.request_reference = payload.requestReference;
  if (payload.appointmentReference) body.appointment_reference = payload.appointmentReference;

  const path = `/citizen/services/${encodeURIComponent(slug)}/feedback/`;
  const { data } = update ? await api.patch(path, body) : await api.post(path, body);
  return data;
}

export async function getAdminServiceFeedback(params = {}) {
  const { data } = await api.get("/admin/service-feedback/", { params });
  return unwrapList(data);
}
