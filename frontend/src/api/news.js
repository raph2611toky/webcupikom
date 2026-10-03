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
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeNews(item) {
  return {
    ...item,
    id: item.id ?? item.slug,
    slug: item.slug,
    category: item.category || "Information",
    kind: item.kind || "Information pratique",
    audience: item.audience || "Tous les habitants",
    title: item.title || "Information municipale",
    excerpt: item.excerpt || "",
    body: item.content || item.body || "",
    image: item.image_url || item.image || FALLBACK_IMAGES[item.category] || fallbackCitizen,
    date: item.date || formatDate(item.published_at),
    published: item.is_published !== false,
  };
}

export async function getNews({ publishedOnly = true } = {}) {
  const endpoint = publishedOnly ? "/city/news/" : "/admin/news/";
  const { data } = await api.get(endpoint, publishedOnly ? { skipAccessToken: true } : {});
  return unwrapList(data).map(normalizeNews);
}


export async function getAlerts(params = {}) {
  const { data } = await api.get("/city/alerts/", { params, skipAccessToken: true });
  return unwrapList(data).map(normalizeNews);
}

export async function getNewsItem(slug, { includeDrafts = false } = {}) {
  const endpoint = includeDrafts
    ? `/admin/news/${encodeURIComponent(slug)}/`
    : `/city/news/${encodeURIComponent(slug)}/`;
  const { data } = await api.get(endpoint, includeDrafts ? {} : { skipAccessToken: true });
  return normalizeNews(data);
}

function toBackendPayload(payload) {
  return {
    title: payload.title,
    category: payload.category || "Information",
    excerpt: payload.excerpt || "",
    content: payload.body ?? payload.content ?? "",
    is_published: payload.published !== false,
    ...(payload.published_at ? { published_at: payload.published_at } : {}),
  };
}

export async function createNews(payload) {
  const { data } = await api.post("/admin/news/", toBackendPayload(payload));
  return normalizeNews(data);
}

async function resolveAdminNews(idOrSlug) {
  const rows = await getNews({ publishedOnly: false });
  return rows.find((item) =>
    String(item.id) === String(idOrSlug) ||
    String(item.slug) === String(idOrSlug)
  ) || null;
}

export async function updateNews(idOrSlug, patch) {
  const current = await resolveAdminNews(idOrSlug);
  if (!current) throw new Error("Publication introuvable.");
  const payload = toBackendPayload({ ...current, ...patch });
  const { data } = await api.patch(`/admin/news/${encodeURIComponent(current.slug)}/`, payload);
  return normalizeNews(data);
}

export async function deleteNews(idOrSlug) {
  const current = await resolveAdminNews(idOrSlug);
  if (!current) return false;
  await api.delete(`/admin/news/${encodeURIComponent(current.slug)}/`);
  return true;
}


/* Native backend naming, used by admin pages. */
export async function getAdminNews(params = {}) {
  const { data } = await api.get("/admin/news/", { params });
  return unwrapList(data).map(normalizeNews);
}

export async function getAdminNewsItem(slug) {
  const { data } = await api.get(`/admin/news/${encodeURIComponent(slug)}/`);
  return normalizeNews(data);
}

export async function createAdminNews(payload) {
  const { data } = await api.post("/admin/news/", {
    title: payload.title,
    category: payload.category || "Information",
    excerpt: payload.excerpt || "",
    content: payload.content ?? payload.body ?? "",
    is_published: payload.is_published ?? payload.published ?? true,
    ...(payload.published_at ? { published_at: payload.published_at } : {}),
  });
  return normalizeNews(data);
}

export async function updateAdminNews(slug, payload) {
  const { data } = await api.patch(`/admin/news/${encodeURIComponent(slug)}/`, {
    title: payload.title,
    category: payload.category || "Information",
    excerpt: payload.excerpt || "",
    content: payload.content ?? payload.body ?? "",
    is_published: payload.is_published ?? payload.published ?? true,
    ...(payload.published_at ? { published_at: payload.published_at } : {}),
  });
  return normalizeNews(data);
}

export async function unpublishAdminNews(slug) {
  await api.delete(`/admin/news/${encodeURIComponent(slug)}/`);
}
