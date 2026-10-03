import { services as seedServices } from "../data/services.js";

const STORAGE_KEY = "terra_nova_services_v1";

function slugify(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readServices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seeded = seedServices.map((item) => ({
    ...item,
    published: item.published !== false,
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function writeServices(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  window.dispatchEvent(new CustomEvent("terra-services-updated"));
  return items;
}

export async function getServices({ publishedOnly = true } = {}) {
  const items = readServices();
  return publishedOnly ? items.filter((item) => item.published !== false) : items;
}

export async function getService(slug, { includeDrafts = false } = {}) {
  const item = readServices().find((entry) => entry.slug === slug) || null;
  if (!item) return null;
  if (!includeDrafts && item.published === false) return null;
  return item;
}

export async function createService(payload) {
  const items = readServices();
  const baseSlug = slugify(payload.name) || `service-${Date.now()}`;
  let slug = baseSlug;
  let i = 2;
  while (items.some((item) => item.slug === slug)) slug = `${baseSlug}-${i++}`;
  const maxId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
  const service = {
    id: maxId + 1,
    slug,
    icon: payload.icon || "◇",
    name: payload.name?.trim() || "Nouveau service",
    category: payload.category || "Administration",
    shortDescription: payload.shortDescription?.trim() || "",
    description: payload.description?.trim() || "",
    openingHours: payload.openingHours?.trim() || "",
    phone: payload.phone?.trim() || "",
    email: payload.email?.trim() || "",
    address: payload.address?.trim() || "",
    actions: payload.actions || [],
    requiredDocuments: payload.requiredDocuments || [],
    faq: payload.faq || [],
    published: payload.published !== false,
    updatedAt: new Date().toISOString(),
  };
  writeServices([...items, service]);
  return service;
}

export async function updateService(id, patch) {
  const items = readServices();
  const next = items.map((item) => String(item.id) === String(id) ? {
    ...item,
    ...patch,
    updatedAt: new Date().toISOString(),
  } : item);
  writeServices(next);
  return next.find((item) => String(item.id) === String(id)) || null;
}

export async function deleteService(id) {
  writeServices(readServices().filter((item) => String(item.id) !== String(id)));
  return true;
}

export async function getServiceCategories() {
  const items = readServices();
  return ["Tous", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
}
