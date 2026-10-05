import { api } from "./api.js";
import { unwrapList } from "./helpers.js";
import fallbackCitizen from "../assets/hero/hero-1.webp";
import fallbackTransport from "../assets/hero/hero-travel.webp";
import fallbackAdmin from "../assets/hero/hero-list.webp";
import fallbackHealth from "../assets/hero/hero-phone.webp";
import { cachedRequest, invalidateCache } from "./cache.js";

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


function normalizeAudienceGuidance(value) {
  if (!value) return [];

  if (!Array.isArray(value) && typeof value === "object") {
    if (Array.isArray(value.items)) value = value.items;
    else if (Array.isArray(value.results)) value = value.results;
    else {
      value = Object.entries(value).map(([audience, instructions]) => ({
        audience,
        instructions: typeof instructions === "string"
          ? instructions
          : instructions?.instructions || instructions?.message || "",
      }));
    }
  }

  if (typeof value === "string") {
    value = value
      .split(/\r?\n|;/g)
      .map((audience) => audience.trim())
      .filter(Boolean)
      .map((audience) => ({ audience, instructions: "" }));
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const audience = item.trim();
        return audience ? { audience, instructions: "" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const audience = String(
        item.audience ||
        item.public ||
        item.target ||
        item.group ||
        item.name ||
        ""
      ).trim();
      const instructions = String(
        item.instructions ||
        item.instruction ||
        item.message ||
        item.guidance ||
        item.recommendation ||
        ""
      ).trim();
      return audience ? { audience, instructions } : null;
    })
    .filter(Boolean);
}

function firstRichValue(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
    if (value && typeof value === "object" && Object.keys(value).length) return value;
    if (typeof value === "string" && value.trim()) return value;
    if (value !== undefined && value !== null && typeof value !== "string") return value;
  }
  return "";
}

function richNewsFields(item = {}) {
  const details = item.details && typeof item.details === "object" ? item.details : {};
  const alert = item.alert && typeof item.alert === "object" ? item.alert : {};
  const guidance = item.guidance && typeof item.guidance === "object" ? item.guidance : {};

  return {
    affectedAreas: firstRichValue(
      item.affected_areas,
      item.affectedAreas,
      item.affected_zones,
      item.areas,
      details.affected_areas,
      details.affectedAreas,
      alert.affected_areas,
    ),
    instructions: firstRichValue(
      item.instructions,
      item.public_instructions,
      item.safety_instructions,
      item.recommendations,
      item.recommendation,
      typeof item.guidance === "string" ? item.guidance : "",
      details.instructions,
      details.recommendations,
      alert.instructions,
      alert.recommendations,
      guidance.instructions,
      guidance.recommendations,
    ),
    audienceGuidanceRaw: firstRichValue(
      item.audience_guidance,
      item.audienceGuidance,
      item.public_guidance,
      item.target_guidance,
      details.audience_guidance,
      alert.audience_guidance,
      guidance.audience_guidance,
      guidance.audiences,
    ),
    sourceName: firstRichValue(item.source_name, item.sourceName, details.source_name, alert.source_name),
    sourceUrl: firstRichValue(item.source_url, item.sourceUrl, details.source_url, alert.source_url),
    actionLabel: firstRichValue(item.action_label, item.actionLabel, details.action_label, alert.action_label),
    actionUrl: firstRichValue(item.action_url, item.actionUrl, details.action_url, alert.action_url),
  };
}

function isBlankRichValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return value === undefined || value === null || String(value).trim() === "";
}

function mergeNewsDetail(primary, ...fallbacks) {
  const merged = { ...primary };
  const richKeys = [
    "affectedAreas",
    "instructions",
    "audienceGuidance",
    "audienceGuidanceList",
    "sourceName",
    "sourceUrl",
    "actionLabel",
    "actionUrl",
  ];

  for (const fallback of fallbacks.filter(Boolean)) {
    for (const key of richKeys) {
      if (isBlankRichValue(merged[key]) && !isBlankRichValue(fallback[key])) {
        merged[key] = fallback[key];
      }
    }
    if (!merged.important && fallback.important) merged.important = true;
    if (!merged.pinned && fallback.pinned) merged.pinned = true;
  }

  return merged;
}

function audienceGuidanceText(value) {
  return normalizeAudienceGuidance(value)
    .map((item) => item.audience)
    .filter(Boolean)
    .join("\n");
}

function toAudienceGuidance(value, fallbackInstructions = "") {
  if (Array.isArray(value)) {
    const rows = normalizeAudienceGuidance(value);
    return rows.map((item) => ({
      audience: item.audience.slice(0, 120),
      instructions: (item.instructions || fallbackInstructions || "Consulter les informations et consignes de cette publication.").slice(0, 5000),
    }));
  }

  const rows = String(value || "")
    .split(/\r?\n|;/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return rows.slice(0, 20).map((audience) => ({
    audience: audience.slice(0, 120),
    instructions: (fallbackInstructions || "Consulter les informations et consignes de cette publication.").slice(0, 5000),
  }));
}

function normalizeNews(item) {
  const publicationType = item.publication_type || item.publicationType || "news";
  const rich = richNewsFields(item);
  const audienceGuidanceList = normalizeAudienceGuidance(rich.audienceGuidanceRaw);
  return {
    ...item,
    id: item.id ?? item.slug,
    slug: item.slug,
    category: item.category || "Information",
    publicationType,
    publication_type: publicationType,
    severity: item.severity || "info",
    kind: publicationType === "alert" ? "Alerte" : publicationType === "announcement" ? "Annonce" : "Actualité",
    audience: item.audience || "Tous les habitants",
    title: item.title || "Information municipale",
    excerpt: item.excerpt || "",
    body: item.content || item.body || "",
    content: item.content || item.body || "",
    image: item.cover_url || item.image_url || item.image || FALLBACK_IMAGES[item.category] || fallbackCitizen,
    coverAlt: item.cover_alt || "",
    cover_alt: item.cover_alt || "",
    date: item.date || formatDate(item.published_at),
    published: item.is_published !== false && item.publication_state !== "draft",
    important: Boolean(item.is_important),
    pinned: Boolean(item.is_pinned),
    notifyResidents: item.notify_residents !== false,
    targetDistricts: Array.isArray(item.target_districts) ? item.target_districts : [],
    affectedAreas: String(rich.affectedAreas || ""),
    instructions: Array.isArray(rich.instructions)
      ? rich.instructions.map((value) => typeof value === "string" ? value : value?.text || value?.message || value?.instruction || "").filter(Boolean).join("\n")
      : String(rich.instructions || ""),
    audienceGuidance: audienceGuidanceList.map((entry) => entry.audience).join("\n"),
    audienceGuidanceList,
    sourceName: String(rich.sourceName || ""),
    sourceUrl: String(rich.sourceUrl || ""),
    contactPhone: item.contact_phone || "",
    actionLabel: String(rich.actionLabel || ""),
    actionUrl: String(rich.actionUrl || ""),
    serviceId: item.service ?? null,
    expiresAt: item.expires_at || "",
    publishedAt: item.published_at || "",
    publicationState: item.publication_state || "",
  };
}

export async function getNews({ publishedOnly = true, force = false } = {}) {
  const endpoint = publishedOnly ? "/city/news/" : "/admin/news/";
  const load = async () => {
    const { data } = await api.get(endpoint, publishedOnly ? { skipAccessToken: true } : {});
    return unwrapList(data).map(normalizeNews);
  };
  if (!publishedOnly || force) return load();
  return cachedRequest("news:list:public", load, { ttl: 60_000 });
}

export async function getAlerts(params = {}) {
  const key = `alerts:list:${JSON.stringify(params || {})}`;
  return cachedRequest(key, async () => {
    const { data } = await api.get("/city/alerts/", { params, skipAccessToken: true });
    return unwrapList(data).map(normalizeNews);
  }, { ttl: 20_000 });
}

export async function getNewsItem(slug, { includeDrafts = false, force = false } = {}) {
  const endpoint = includeDrafts
    ? `/admin/news/${encodeURIComponent(slug)}/`
    : `/city/news/${encodeURIComponent(slug)}/`;

  const load = async () => {
    const { data } = await api.get(endpoint, includeDrafts ? {} : { skipAccessToken: true });
    const detail = normalizeNews(data);

    if (includeDrafts) return detail;

    const missingRichData =
      !detail.instructions &&
      !detail.affectedAreas &&
      !detail.audienceGuidanceList?.length &&
      !detail.sourceName &&
      !detail.actionUrl;

    if (!missingRichData) return detail;

    const [newsResult, alertsResult] = await Promise.allSettled([
      getNews({ publishedOnly: true, force: true }),
      getAlerts({}),
    ]);

    const candidates = [
      ...(newsResult.status === "fulfilled" ? newsResult.value : []),
      ...(alertsResult.status === "fulfilled" ? alertsResult.value : []),
    ].filter((item) => String(item.slug) === String(slug));

    return mergeNewsDetail(detail, ...candidates);
  };

  if (includeDrafts || force) return load();
  return cachedRequest(`news:item:${slug}:v120`, load, { ttl: 30_000 });
}

function splitDistricts(payload) {
  if (Array.isArray(payload.target_districts)) return payload.target_districts.filter(Boolean);
  if (Array.isArray(payload.targetDistricts)) return payload.targetDistricts.filter(Boolean);
  return String(payload.target_districts || payload.targetDistricts || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function setOptional(payload, key, value) {
  if (value === undefined || value === null || value === "") return;
  payload[key] = value;
}

function toBackendPayload(payload) {
  const data = {
    title: payload.title,
    category: payload.category || "Information",
    excerpt: payload.excerpt || "",
    content: payload.body ?? payload.content ?? "",
    publication_type: payload.publication_type || payload.publicationType || "news",
    severity: payload.severity || "info",
    is_published: payload.is_published ?? payload.published ?? true,
    is_important: payload.is_important ?? payload.important ?? false,
    is_pinned: payload.is_pinned ?? payload.pinned ?? false,
    notify_residents: payload.notify_residents ?? payload.notifyResidents ?? true,
    target_districts: splitDistricts(payload),
    affected_areas: payload.affected_areas ?? payload.affectedAreas ?? "",
    instructions: payload.instructions || "",
    audience_guidance: toAudienceGuidance(
      payload.audience_guidance ?? payload.audienceGuidance ?? [],
      payload.instructions || payload.content || payload.body || "",
    ),
    source_name: payload.source_name ?? payload.sourceName ?? "",
    contact_phone: payload.contact_phone ?? payload.contactPhone ?? "",
    action_label: payload.action_label ?? payload.actionLabel ?? "",
    cover_alt: payload.cover_alt ?? payload.coverAlt ?? "",
    expires_at: payload.expires_at || payload.expiresAt || null,
  };

  setOptional(data, "slug", payload.slug);
  setOptional(data, "published_at", payload.published_at || payload.publishedAt);
  setOptional(data, "source_url", payload.source_url || payload.sourceUrl);
  setOptional(data, "action_url", payload.action_url || payload.actionUrl);

  const rawService = payload.service ?? payload.serviceId;
  if (rawService !== undefined && rawService !== null && rawService !== "") {
    const service = Number(rawService);
    if (Number.isFinite(service)) data.service = service;
  } else {
    data.service = null;
  }

  return data;
}

function newsUpdated() {
  invalidateCache("news:");
  invalidateCache("alerts:");
  window.dispatchEvent(new Event("terra-news-updated"));
}

export async function createNews(payload) {
  const { data } = await api.post("/admin/news/", toBackendPayload(payload));
  newsUpdated();
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
  newsUpdated();
  return normalizeNews(data);
}

export async function deleteNews(idOrSlug) {
  const current = await resolveAdminNews(idOrSlug);
  if (!current) return false;
  await api.delete(`/admin/news/${encodeURIComponent(current.slug)}/`);
  newsUpdated();
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
  const { data } = await api.post("/admin/news/", toBackendPayload(payload));
  newsUpdated();
  return normalizeNews(data);
}

export async function updateAdminNews(slug, payload) {
  const { data } = await api.patch(`/admin/news/${encodeURIComponent(slug)}/`, toBackendPayload(payload));
  newsUpdated();
  return normalizeNews(data);
}

export async function uploadAdminNewsCover(slug, image, coverAlt) {
  if (!image) return null;
  if (!coverAlt?.trim()) throw new Error("Le texte alternatif de l’image est obligatoire.");
  const form = new FormData();
  form.append("image", image);
  form.append("cover_alt", coverAlt.trim());
  const { data } = await api.post(`/admin/news/${encodeURIComponent(slug)}/cover/`, form);
  newsUpdated();
  return data;
}

export async function getAdminNewsDelivery(slug) {
  const { data } = await api.get(`/admin/news/${encodeURIComponent(slug)}/delivery/`);
  return data;
}

export async function unpublishAdminNews(slug) {
  const { data } = await api.patch(`/admin/news/${encodeURIComponent(slug)}/`, { is_published: false });
  newsUpdated();
  return normalizeNews(data);
}

export async function deleteAdminNews(slug) {
  await api.delete(`/admin/news/${encodeURIComponent(slug)}/`);
  newsUpdated();
  return true;
}
