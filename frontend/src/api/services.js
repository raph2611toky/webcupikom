import { api } from "./api.js";
import { services as presentationServices } from "../data/services.js";
import { unwrapList } from "./helpers.js";
import { SERVICE_TRANSLATIONS } from "../data/serviceTranslations.js";
import { getLocale } from "../utils/i18n.js";
import { cachedRequest, invalidateCache } from "./cache.js";
import { GEMINI_HIGHLIGHTS_CONFIG } from "../config/gemini.js";

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

function deterministicHighlights(items = [], limit = 4) {
  const rows = items.map(normalizeService);
  const byPriority = [...rows].sort((a, b) =>
    Number(b.isFeatured) - Number(a.isFeatured) ||
    Number(a.priorityOrder ?? 999) - Number(b.priorityOrder ?? 999) ||
    Number(b.usageCount ?? 0) - Number(a.usageCount ?? 0) ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
  const popular = [...rows].sort((a, b) =>
    Number(b.usageCount ?? 0) - Number(a.usageCount ?? 0) ||
    Number(b.isFeatured) - Number(a.isFeatured) ||
    Number(a.priorityOrder ?? 999) - Number(b.priorityOrder ?? 999)
  ).slice(0, limit);

  const featured = byPriority.filter((item) => item.isFeatured).slice(0, limit);
  if (featured.length < limit) {
    for (const item of byPriority) {
      if (featured.some((entry) => String(entry.slug) === String(item.slug))) continue;
      featured.push(item);
      if (featured.length >= limit) break;
    }
  }

  return { featured, popular, source: "local" };
}

function parseGeminiJson(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

async function getGeminiHighlights(items = [], limit = 4) {
  const token = String(GEMINI_HIGHLIGHTS_CONFIG.token || "").trim();
  if (!token || !Array.isArray(items) || items.length === 0) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GEMINI_HIGHLIGHTS_CONFIG.timeoutMs || 4500);
  try {
    const servicesForPrompt = items.map((item) => ({
      slug: item.slug,
      name: item.name,
      category: item.category,
      short_description: item.shortDescription || item.short_description || "",
      is_featured: Boolean(item.isFeatured ?? item.is_featured),
      priority_order: Number(item.priorityOrder ?? item.priority_order ?? 0),
      usage_count: Number(item.usageCount ?? item.usage_count ?? 0),
      availability: item.isAvailable === false ? "indisponible" : "disponible",
    }));

    const prompt = [
      "Tu aides une plateforme municipale à sélectionner les services à mettre en avant.",
      `Retourne uniquement un JSON valide avec featured_slugs, popular_slugs et reasons. Chaque tableau doit contenir au maximum ${limit} slugs.`,
      "Contraintes : n'invente jamais de slug ; privilégie is_featured=true puis priority_order faible pour featured_slugs ; classe popular_slugs principalement avec usage_count décroissant ; évite les services indisponibles quand une alternative disponible existe.",
      "reasons doit être un objet {slug: raison courte en français}.",
      `Services : ${JSON.stringify(servicesForPrompt)}`,
    ].join("\n");

    const headers = { "Content-Type": "application/json" };
    if (/^AIza/i.test(token)) headers["x-goog-api-key"] = token;
    else headers.Authorization = `Bearer ${token}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_HIGHLIGHTS_CONFIG.model)}:generateContent`,
      {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || "";
    const parsed = parseGeminiJson(rawText);
    if (!parsed) return null;

    const bySlug = new Map(items.map((item) => [String(item.slug), normalizeService(item)]));
    const reasons = parsed?.reasons && typeof parsed.reasons === "object" ? parsed.reasons : {};
    const pick = (slugs) => (Array.isArray(slugs) ? slugs : [])
      .map((slug) => bySlug.get(String(slug)))
      .filter(Boolean)
      .slice(0, limit)
      .map((item) => ({ ...item, highlightReason: String(reasons[item.slug] || "") }));

    const featured = pick(parsed.featured_slugs);
    const popular = pick(parsed.popular_slugs);
    if (!featured.length && !popular.length) return null;

    const local = deterministicHighlights(items, limit);
    return {
      featured: featured.length ? featured : local.featured,
      popular: popular.length ? popular : local.popular,
      source: "gemini",
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function highlightsEndpointUnavailable(error) {
  const status = Number(error?.response?.status || 0);
  return !error?.response || status === 404 || status === 405 || status === 408 || status === 429 || status === 501 || status >= 500;
}

export async function getServiceHighlights({ limit = 4, force = false } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 4, 1), 20);
  const load = async () => {
    try {
      const { data } = await api.get("/city/services/highlights/", {
        params: { limit: safeLimit },
        skipAccessToken: true,
        timeout: 3000,
      });
      return {
        featured: (Array.isArray(data?.featured) ? data.featured : []).map(normalizeService),
        popular: (Array.isArray(data?.popular) ? data.popular : []).map(normalizeService),
        source: "backend",
      };
    } catch (error) {
      if (!highlightsEndpointUnavailable(error)) throw error;

      // Fallback 1 : Gemini analyse la liste réelle des services lorsque
      // /city/services/highlights/ est indisponible.
      const services = await getServices({ force: true });
      const gemini = await getGeminiHighlights(services, safeLimit);
      if (gemini) return gemini;

      // Fallback 2 : tri local déterministe. L'interface reste utilisable même
      // si Gemini est lui aussi indisponible.
      return deterministicHighlights(services, safeLimit);
    }
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
