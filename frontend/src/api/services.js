
import { api } from "./api.js";
import { services as presentationServices } from "../data/services.js";
import { SERVICE_TRANSLATIONS } from "../data/serviceTranslations.js";
import { unwrapList } from "./helpers.js";
import { getLocale } from "../utils/i18n.js";

const presentationBySlug = new Map(presentationServices.map((item) => [item.slug, item]));

function translatedPresentation(slug) {
  const locale = getLocale();
  if (locale === "fr") return {};
  return SERVICE_TRANSLATIONS[slug]?.[locale] || {};
}

export function normalizeService(item) {
  const presentation = presentationBySlug.get(item.slug) || {};
  const translation = translatedPresentation(item.slug);
  const normalized = {
    ...presentation,
    ...item,
    shortDescription: item.short_description ?? presentation.shortDescription ?? "",
    openingHours: item.opening_hours ?? presentation.openingHours ?? "",
    icon: presentation.icon || "◇",
    actions: item.actions ?? presentation.actions ?? [],
    requiredDocuments: item.required_documents ?? presentation.requiredDocuments ?? [],
    faq: item.faq ?? presentation.faq ?? [],
    sortOrder: Number(item.sort_order ?? presentation.sortOrder ?? 999),
    isActive: item.is_active !== false,
  };

  // For the six known core services, English presentation is available immediately.
  return {
    ...normalized,
    ...translation,
    shortDescription: translation.shortDescription ?? normalized.shortDescription,
    openingHours: translation.openingHours ?? normalized.openingHours,
    actions: translation.actions ?? normalized.actions,
    requiredDocuments: translation.requiredDocuments ?? normalized.requiredDocuments,
  };
}

function sortServices(items) {
  return [...items].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || String(a.name).localeCompare(String(b.name)));
}

export async function getServices(params = {}) {
  const { data } = await api.get("/city/services/", { params, skipAccessToken: true });
  return sortServices(unwrapList(data).map(normalizeService));
}

export async function getService(slug) {
  const { data } = await api.get(`/city/services/${encodeURIComponent(slug)}/`, { skipAccessToken: true });
  return normalizeService(data);
}

export function getServiceCategories(items = []) {
  return ["Tous", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
}

export async function getAdminServices(params = {}) {
  const { data } = await api.get("/admin/services/", { params });
  return sortServices(unwrapList(data).map(normalizeService));
}

export async function getAdminService(slug) {
  const { data } = await api.get(`/admin/services/${encodeURIComponent(slug)}/`);
  return normalizeService(data);
}

export async function createAdminService(payload) {
  const { data } = await api.post("/admin/services/", payload);
  return normalizeService(data);
}

export async function updateAdminService(slug, payload) {
  const { data } = await api.patch(`/admin/services/${encodeURIComponent(slug)}/`, payload);
  return normalizeService(data);
}

export async function disableAdminService(slug) {
  await api.delete(`/admin/services/${encodeURIComponent(slug)}/`);
}
