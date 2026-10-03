import { api } from "./api.js";
import { services as presentationServices } from "../data/services.js";
import { unwrapList } from "./helpers.js";

const presentationBySlug = new Map(presentationServices.map((item) => [item.slug, item]));

export function normalizeService(item) {
  const presentation = presentationBySlug.get(item.slug);
  return {
    ...presentation,
    ...item,
    shortDescription: item.short_description ?? presentation?.shortDescription ?? "",
    openingHours: item.opening_hours ?? presentation?.openingHours ?? "",
    icon: presentation?.icon || "◇",
    actions: presentation?.actions || [],
    requiredDocuments: presentation?.requiredDocuments || [],
    faq: presentation?.faq || [],
  };
}

export async function getServices(params = {}) {
  const { data } = await api.get("/city/services/", { params, skipAccessToken: true });
  return unwrapList(data).map(normalizeService);
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
  return unwrapList(data).map(normalizeService);
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
