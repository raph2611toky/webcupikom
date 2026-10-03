
import { api } from "./api.js";
import { unwrapList } from "./helpers.js";
import fallbackCitizen from "../assets/hero/hero-1.webp";
import fallbackTransport from "../assets/hero/hero-travel.webp";
import fallbackAdmin from "../assets/hero/hero-list.webp";
import fallbackHealth from "../assets/hero/hero-phone.webp";

const FALLBACK_IMAGES = {
  Important: fallbackCitizen,
  Transport: fallbackTransport,
  Administration: fallbackAdmin,
  Santé: fallbackHealth,
  Information: fallbackCitizen,
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function normalizeNews(item) {
  return {
    ...item,
    date: formatDate(item.published_at),
    body: item.content || item.body || "",
    published: item.is_published !== false,
    kind: item.kind || "Information pratique",
    audience: item.audience || "Tous les habitants",
    image: item.image_url || item.image || FALLBACK_IMAGES[item.category] || fallbackCitizen,
  };
}

export async function getNews(params = {}) {
  const { data } = await api.get("/city/news/", { params, skipAccessToken: true });
  return unwrapList(data).map(normalizeNews);
}

export async function getNewsItem(slug) {
  const { data } = await api.get(`/city/news/${encodeURIComponent(slug)}/`, { skipAccessToken: true });
  return normalizeNews(data);
}

export async function getAdminNews(params = {}) {
  const { data } = await api.get("/admin/news/", { params });
  return unwrapList(data).map(normalizeNews);
}

export async function getAdminNewsItem(slug) {
  const { data } = await api.get(`/admin/news/${encodeURIComponent(slug)}/`);
  return normalizeNews(data);
}

export async function createAdminNews(payload) {
  const { data } = await api.post("/admin/news/", payload);
  return normalizeNews(data);
}

export async function updateAdminNews(slug, payload) {
  const { data } = await api.patch(`/admin/news/${encodeURIComponent(slug)}/`, payload);
  return normalizeNews(data);
}

export async function unpublishAdminNews(slug) {
  await api.delete(`/admin/news/${encodeURIComponent(slug)}/`);
}
