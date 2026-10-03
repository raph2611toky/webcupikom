import { api } from "./api.js";
import { services as presentationServices } from "../data/services.js";
import { unwrapList } from "./helpers.js";
import { SERVICE_TRANSLATIONS } from "../data/serviceTranslations.js";
import { getLocale } from "../utils/i18n.js";
import { cachedRequest, invalidateCache } from "./cache.js";

const presentationBySlug = new Map(presentationServices.map((item) => [item.slug, item]));

function normalizeService(item) {
  const presentation = presentationBySlug.get(item.slug) || {};
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
    actions: item.actions ?? presentation.actions ?? [],
    requiredDocuments: item.required_documents ?? item.requiredDocuments ?? presentation.requiredDocuments ?? [],
    faq: item.faq ?? presentation.faq ?? [],
    published: item.is_active !== false,
    is_active: item.is_active !== false,
    sortOrder: Number(item.sort_order ?? item.sortOrder ?? presentation.sortOrder ?? 999),
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
  } : base;
}

function sortRows(items) {
  return [...items].sort((a,b) =>
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
  return cachedRequest(`services:list:${getLocale()}`, load, { ttl: 120_000 });
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
  return cachedRequest(`services:item:${getLocale()}:${slug}`, load, { ttl: 120_000 });
}

function toBackendPayload(payload) {
  return {
    name: payload.name,
    category: payload.category,
    short_description: payload.shortDescription ?? payload.short_description ?? "",
    description: payload.description ?? "",
    opening_hours: payload.openingHours ?? payload.opening_hours ?? "",
    phone: payload.phone ?? "",
    email: payload.email ?? "",
    address: payload.address ?? "",
    is_active: payload.published ?? payload.is_active ?? true,
    sort_order: Number(payload.sortOrder ?? payload.sort_order ?? 0),
  };
}

export async function createService(payload) {
  const { data } = await api.post("/admin/services/", toBackendPayload(payload));
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

  const payload = toBackendPayload({ ...current, ...patch });
  const { data } = await api.patch(`/admin/services/${encodeURIComponent(current.slug)}/`, payload);
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

export async function getServiceCategories() {
  const items = await getServices();
  return ["Tous", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
}
