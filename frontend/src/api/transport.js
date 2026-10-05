import { api } from "./api.js";
import { unwrapList } from "./helpers.js";

function parseMaybeObject(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLines(value) {
  const source = parseMaybeObject(value, value);
  if (Array.isArray(source)) return source.map((entry) => typeof entry === "string" ? { id: entry, name: entry } : entry);
  if (source && typeof source === "object") {
    return Object.entries(source).map(([key, entry]) => {
      if (entry && typeof entry === "object") return { id: entry.id ?? key, name: entry.name ?? entry.label ?? key, ...entry };
      return { id: key, name: String(entry ?? key) };
    });
  }
  if (typeof source === "string") return source.split(/[,;\n]/).map((v) => v.trim()).filter(Boolean).map((v) => ({ id: v, name: v }));
  return [];
}

function timetableEntry(entry, index) {
  const fallbackKey = `Passage ${index + 1}`;
  if (entry == null) return { key: fallbackKey, value: "—" };
  if (typeof entry !== "object") return { key: fallbackKey, value: entry };

  if (
    Object.prototype.hasOwnProperty.call(entry, "key") &&
    Object.prototype.hasOwnProperty.call(entry, "value")
  ) {
    return { key: entry.key || fallbackKey, value: entry.value };
  }

  const labelKeys = [
    "label", "day", "jour", "weekday", "name", "title", "period", "periode",
    "line", "route", "direction", "destination",
  ];
  const valueKeys = [
    "value", "hours", "horaires", "time", "schedule", "slots", "periods",
    "opening_hours",
  ];
  const startKeys = ["starts_at", "start_at", "start", "from", "departure"];
  const endKeys = ["ends_at", "end_at", "end", "to", "arrival"];

  const labelKey = labelKeys.find((key) => entry[key] != null && entry[key] !== "");
  const valueKey = valueKeys.find((key) => entry[key] != null && entry[key] !== "");
  const startKey = startKeys.find((key) => entry[key] != null && entry[key] !== "");
  const endKey = endKeys.find((key) => entry[key] != null && entry[key] !== "");

  if (labelKey && valueKey) {
    return { key: entry[labelKey], value: entry[valueKey] };
  }

  if (startKey || endKey) {
    const key = labelKey ? entry[labelKey] : fallbackKey;
    return {
      key,
      value: {
        starts_at: startKey ? entry[startKey] : "",
        ends_at: endKey ? entry[endKey] : "",
        duration_minutes: entry.duration_minutes ?? entry.duration ?? null,
        frequency_minutes: entry.frequency_minutes ?? entry.frequency ?? null,
        timezone: entry.timezone ?? entry.tz ?? "",
      },
    };
  }

  const remaining = Object.entries(entry).filter(([key]) => key !== labelKey);
  if (remaining.length === 1) {
    const [key, value] = remaining[0];
    return { key: labelKey ? entry[labelKey] : key, value };
  }

  return {
    key: labelKey ? entry[labelKey] : fallbackKey,
    value: Object.fromEntries(remaining.length ? remaining : Object.entries(entry)),
  };
}

function normalizeTimetable(value) {
  const source = parseMaybeObject(value, value);
  if (Array.isArray(source)) return source.map(timetableEntry);
  if (source && typeof source === "object") {
    return Object.entries(source).map(([key, entry]) => ({ key, value: entry }));
  }
  if (typeof source === "string" && source.trim()) return [{ key: "Horaires", value: source.trim() }];
  return [];
}

export function normalizeTransportStop(item = {}) {
  return {
    ...item,
    id: item.id,
    slug: item.slug || String(item.id || ""),
    name: item.name || "Arrêt de transport",
    kind: item.kind || "transport_stop",
    kindLabel: item.kind_label || "Arrêt de transport",
    category: item.category || "Transport",
    description: item.description || "",
    address: item.address || "",
    district: item.district || "",
    openingHours: item.opening_hours || "",
    phone: item.phone || "",
    email: item.email || "",
    website: item.website || "",
    latitude: numberOrNull(item.latitude),
    longitude: numberOrNull(item.longitude),
    distanceKm: numberOrNull(item.distance_km),
    lines: normalizeLines(item.transport_lines),
    timetable: normalizeTimetable(item.timetable),
    practicalInfo: parseMaybeObject(item.practical_info, {}),
    isActive: item.is_active !== false,
    sortOrder: Number(item.sort_order ?? 0),
    updatedAt: item.updated_at || "",
    createdAt: item.created_at || "",
  };
}

function collectOverviewStops(data) {
  if (Array.isArray(data)) return data;
  const candidates = [data?.stops, data?.locations, data?.results, data?.transport_stops];
  return candidates.find(Array.isArray) || [];
}

function collectOverviewLines(data, stops) {
  const direct = data?.lines || data?.transport_lines || data?.routes;
  const normalized = normalizeLines(direct);
  if (normalized.length) return normalized;
  const map = new Map();
  stops.forEach((stop) => stop.lines.forEach((line) => map.set(String(line.id ?? line.name), line)));
  return [...map.values()];
}

export function normalizeTransportOverview(data = {}) {
  const stops = collectOverviewStops(data).map(normalizeTransportStop);
  return {
    raw: data,
    stops,
    lines: collectOverviewLines(data, stops),
    timetable: normalizeTimetable(data?.timetable || data?.schedules || data?.hours),
  };
}

export async function getCityTransport({ district, line } = {}) {
  const { data } = await api.get("/city/transport/", { params: { district, line } });
  return normalizeTransportOverview(data || {});
}

export async function getTransportStops({ district, category, search, lat, lon, radiusKm } = {}) {
  const { data } = await api.get("/city/locations/", {
    params: {
      kind: "transport_stop",
      district,
      category,
      search,
      lat,
      lon,
      radius_km: radiusKm,
    },
  });
  return unwrapList(data).map(normalizeTransportStop);
}

export async function getTransportStop(slug) {
  const { data } = await api.get(`/city/locations/${encodeURIComponent(slug)}/`);
  return normalizeTransportStop(data || {});
}

export async function getAdminTransportStops() {
  const { data } = await api.get("/admin/locations/");
  return unwrapList(data).map(normalizeTransportStop).filter((item) => item.kind === "transport_stop");
}

export async function getAdminTransportStop(slug) {
  const { data } = await api.get(`/admin/locations/${encodeURIComponent(slug)}/`);
  return normalizeTransportStop(data || {});
}

function toBackendPayload(payload = {}) {
  const lines = payload.lines ?? payload.transportLines ?? [];
  const timetable = payload.timetable ?? {};
  const practicalInfo = payload.practicalInfo ?? payload.practical_info ?? {};
  return {
    name: payload.name,
    slug: payload.slug || undefined,
    kind: "transport_stop",
    category: payload.category || "Transport",
    description: payload.description || "",
    service: payload.service || null,
    partner_name: payload.partnerName || payload.partner_name || "",
    address: payload.address || "",
    district: payload.district || "",
    opening_hours: payload.openingHours || payload.opening_hours || "",
    phone: payload.phone || "",
    email: payload.email || "",
    website: payload.website || "",
    latitude: payload.latitude === "" ? null : payload.latitude,
    longitude: payload.longitude === "" ? null : payload.longitude,
    transport_lines: lines,
    timetable,
    practical_info: practicalInfo,
    is_active: payload.isActive ?? payload.is_active ?? true,
    sort_order: Number(payload.sortOrder ?? payload.sort_order ?? 0),
  };
}

export async function createAdminTransportStop(payload) {
  const { data } = await api.post("/admin/locations/", toBackendPayload(payload));
  return normalizeTransportStop(data || {});
}

export async function updateAdminTransportStop(slug, payload) {
  const { data } = await api.patch(`/admin/locations/${encodeURIComponent(slug)}/`, toBackendPayload(payload));
  return normalizeTransportStop(data || {});
}

export async function deleteAdminTransportStop(slug) {
  await api.delete(`/admin/locations/${encodeURIComponent(slug)}/`);
  return true;
}
