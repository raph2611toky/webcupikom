import { api } from "./api.js";
import { services as presentationServices } from "../data/services.js";

const presentationBySlug = new Map(presentationServices.map((item) => [item.slug, item]));

function normalizeService(item) {
  const presentation = presentationBySlug.get(item.slug) || {};
  return {
    ...presentation,
    ...item,
    shortDescription: item.short_description ?? presentation.shortDescription ?? "",
    openingHours: item.opening_hours ?? presentation.openingHours ?? "",
    icon: presentation.icon || "◇",
    actions: presentation.actions || [],
    requiredDocuments: presentation.requiredDocuments || [],
    faq: presentation.faq || [],
  };
}

export async function getServices(params = {}) {
  const { data } = await api.get("/city/services/", { params, skipAccessToken: true });
  return (Array.isArray(data) ? data : data?.results || []).map(normalizeService);
}

export async function getService(slug) {
  const { data } = await api.get(`/city/services/${encodeURIComponent(slug)}/`, { skipAccessToken: true });
  return normalizeService(data);
}

export function getServiceCategories(items = []) {
  return ["Tous", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
}
