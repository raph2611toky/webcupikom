import { news as seedNews } from "../data/news.js";
import fallbackCitizen from "../assets/hero/hero-1.webp";
import fallbackTransport from "../assets/hero/hero-travel.webp";
import fallbackAdmin from "../assets/hero/hero-list.webp";
import fallbackHealth from "../assets/hero/hero-phone.webp";

const STORAGE_KEY = "terra_nova_news_v1";

const FALLBACK_IMAGES = {
  Important: fallbackCitizen,
  Transport: fallbackTransport,
  Administration: fallbackAdmin,
  Santé: fallbackHealth,
  Information: fallbackCitizen,
};

function withImage(item) {
  return { ...item, image: item.image || FALLBACK_IMAGES[item.category] || fallbackCitizen };
}

function slugify(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readNews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw).map(withImage);
  } catch {}
  const seeded = seedNews.map((item, index) => withImage({
    id: item.id || `NEWS-${index + 1}`,
    ...item,
    kind: item.kind || "Information pratique",
    audience: item.audience || "Tous les habitants",
    published: item.published !== false,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function writeNews(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  window.dispatchEvent(new CustomEvent("terra-news-updated"));
  return items;
}

export async function getNews({ publishedOnly = true } = {}) {
  const items = readNews();
  return publishedOnly ? items.filter((item) => item.published !== false) : items;
}

export async function getNewsItem(slug, { includeDrafts = false } = {}) {
  const items = readNews();
  const item = items.find((entry) => entry.slug === slug) || null;
  if (!item) return null;
  if (!includeDrafts && item.published === false) return null;
  return item;
}

export async function createNews(payload) {
  const items = readNews();
  const baseSlug = slugify(payload.title) || `publication-${Date.now()}`;
  let slug = baseSlug;
  let i = 2;
  while (items.some((item) => item.slug === slug)) slug = `${baseSlug}-${i++}`;
  const now = new Date().toISOString();
  const item = {
    id: `NEWS-${Date.now()}`,
    slug,
    category: payload.category || "Information",
    kind: payload.kind || "Information pratique",
    audience: payload.audience || "Tous les habitants",
    title: payload.title?.trim() || "Nouvelle publication",
    excerpt: payload.excerpt?.trim() || "",
    body: payload.body?.trim() || "",
    image: payload.image || FALLBACK_IMAGES[payload.category] || fallbackCitizen,
    date: payload.date || new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"long", year:"numeric" }).format(new Date()),
    published: payload.published !== false,
    createdAt: now,
    updatedAt: now,
  };
  writeNews([item, ...items]);
  return item;
}

export async function updateNews(id, patch) {
  const items = readNews();
  const next = items.map((item) => item.id === id ? {
    ...item,
    ...patch,
    updatedAt: new Date().toISOString(),
  } : item);
  writeNews(next);
  return next.find((item) => item.id === id) || null;
}

export async function deleteNews(id) {
  writeNews(readNews().filter((item) => item.id !== id));
  return true;
}
