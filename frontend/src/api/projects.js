import { api } from "./api.js";
import { unwrapList } from "./helpers.js";
import { cachedRequest, invalidateCache } from "./cache.js";

const DEFAULT_CONSULTATION_OPTIONS = [
  { value: "very_favorable", label: "Très favorable" },
  { value: "favorable", label: "Favorable" },
  { value: "neutral", label: "Neutre" },
  { value: "unfavorable", label: "Défavorable" },
];

const DEFAULT_DECISION_OPTIONS = [
  { value: "yes", label: "Oui" },
  { value: "no", label: "Non" },
  { value: "no_opinion", label: "Sans avis" },
];

function parseJsonish(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return fallback;
}

function normalizeStringList(value) {
  const parsed = parseJsonish(value, []);
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") return entry.title || entry.label || entry.name || entry.text || JSON.stringify(entry);
      return String(entry ?? "");
    }).filter(Boolean);
  }
  if (parsed && typeof parsed === "object") {
    return Object.values(parsed).map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") return entry.title || entry.label || entry.name || entry.text || JSON.stringify(entry);
      return String(entry ?? "");
    }).filter(Boolean);
  }
  if (typeof parsed === "string") return parsed.split(/\r?\n|;/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function normalizeMilestones(value) {
  const parsed = parseJsonish(value, []);
  const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? Object.values(parsed) : [];
  return rows.map((entry, index) => {
    if (typeof entry === "string") return { title: entry, status: index === 0 ? "current" : "upcoming" };
    return {
      ...entry,
      title: entry?.title || entry?.label || entry?.name || `Étape ${index + 1}`,
      status: entry?.status || entry?.state || (entry?.completed ? "completed" : "upcoming"),
    };
  });
}

function normalizeOptions(value, participationType) {
  const parsed = parseJsonish(value, null);
  if (Array.isArray(parsed)) {
    const rows = parsed.map((entry) => typeof entry === "string"
      ? { value: entry, label: entry }
      : { value: entry?.value ?? entry?.id ?? entry?.key ?? entry?.label, label: entry?.label ?? entry?.name ?? entry?.value ?? entry?.id });
    if (rows.filter((entry) => entry.value).length) return rows.filter((entry) => entry.value);
  }
  if (parsed && typeof parsed === "object") {
    const rows = Object.entries(parsed).map(([valueKey, labelValue]) => ({
      value: valueKey,
      label: typeof labelValue === "string" ? labelValue : labelValue?.label || labelValue?.name || valueKey,
    }));
    if (rows.length) return rows;
  }
  return participationType === "decision" ? DEFAULT_DECISION_OPTIONS : DEFAULT_CONSULTATION_OPTIONS;
}

function booleanish(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
    if (["false", "0", "no", ""].includes(value.toLowerCase())) return false;
  }
  return fallback;
}

export function normalizeMunicipalProject(item = {}) {
  const participationType = item.participation_type || "none";
  return {
    ...item,
    id: item.id ?? item.slug,
    slug: item.slug || String(item.id || ""),
    title: item.title || "Projet municipal",
    summary: item.short_description ?? item.summary ?? "",
    shortDescription: item.short_description ?? item.summary ?? "",
    description: item.description || item.short_description || "",
    district: item.district || "Nova Terra",
    status: item.status || "planned",
    statusLabel: item.status_label || "",
    progress: Math.max(0, Math.min(100, Number(item.progress || 0))),
    start_date: item.start_date || "",
    expected_end_date: item.expected_end_date || "",
    actual_end_date: item.actual_end_date || "",
    objectives: normalizeStringList(item.objectives),
    milestones: normalizeMilestones(item.milestones),
    participation_type: participationType,
    participationType,
    participationTypeLabel: item.participation_type_label || "",
    participation_question: item.participation_question || "",
    participationQuestion: item.participation_question || "",
    participationOptions: normalizeOptions(item.participation_options, participationType),
    participation_opens_at: item.participation_opens_at || "",
    participation_closes_at: item.participation_closes_at || "",
    participationIsOpen: item.participation_is_open !== undefined
      ? booleanish(item.participation_is_open)
      : participationType !== "none",
    supportEnabled: booleanish(item.support_enabled),
    supportCount: Number(item.support_count || 0),
    isSupported: booleanish(item.is_supported),
    isPublished: item.is_published !== false,
    participationCount: Number(item.participation_count || 0),
    ideaCount: Number(item.idea_count || 0),
    publishedAt: item.published_at || "",
    updatedAt: item.updated_at || "",
  };
}

function normalizeContribution(item = {}) {
  return {
    ...item,
    id: item.reference || `${item.project_slug || "project"}-${item.created_at || "contribution"}`,
    reference: item.reference || "",
    projectSlug: item.project_slug || "",
    projectTitle: item.project_title || "Projet municipal",
    type: item.contribution_type || item.type || "consultation",
    typeLabel: item.contribution_type_label || "",
    question: item.question_snapshot || "",
    choice: item.choice || "",
    choiceLabel: item.choice_label || item.choice || "",
    comment: item.comment || "",
    createdAt: item.created_at || "",
    updatedAt: item.updated_at || item.created_at || "",
    confirmation: item.confirmation || "Participation enregistrée.",
    citizenId: item.citizen_id,
    citizenEmail: item.citizen_email || "",
    citizenName: item.citizen_name || item.citizen_email || "Citoyen",
  };
}

function normalizeIdea(item = {}) {
  return {
    ...item,
    id: item.reference || item.id,
    reference: item.reference || "",
    projectSlug: item.project_slug || "",
    projectTitle: item.project_title || "",
    title: item.title || "Idée citoyenne",
    category: item.category || "Autre",
    district: item.district || "",
    description: item.description || "",
    status: item.status || "submitted",
    statusLabel: item.status_label || "",
    staffNote: item.staff_note || "",
    citizenId: item.citizen_id,
    citizenEmail: item.citizen_email || "",
    citizenName: item.citizen_name || item.citizen_email || "Citoyen",
    createdAt: item.created_at || "",
    updatedAt: item.updated_at || item.created_at || "",
    confirmation: item.confirmation || "Proposition enregistrée.",
  };
}

function cleanNullable(value) {
  return value === "" || value === undefined ? null : value;
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function optionsObject(value, participationType) {
  const rows = normalizeOptions(value, participationType);
  return Object.fromEntries(rows.map((entry) => [String(entry.value), String(entry.label)]));
}

function projectPayload(payload = {}) {
  const participationType = payload.participation_type || payload.participationType || "none";
  const objectives = Array.isArray(payload.objectives)
    ? payload.objectives
    : normalizeStringList(payload.objectivesText ?? payload.objectives);
  const milestones = Array.isArray(payload.milestones)
    ? payload.milestones
    : normalizeStringList(payload.milestonesText ?? payload.milestones).map((title, index) => ({ title, status: index === 0 ? "current" : "upcoming" }));
  return {
    ...(payload.slug ? { slug: payload.slug } : {}),
    title: payload.title,
    short_description: payload.short_description ?? payload.shortDescription ?? payload.summary ?? "",
    description: payload.description || "",
    district: payload.district || "",
    status: payload.status || "planned",
    progress: Math.max(0, Math.min(100, Number(payload.progress || 0))),
    start_date: cleanNullable(payload.start_date),
    expected_end_date: cleanNullable(payload.expected_end_date),
    actual_end_date: cleanNullable(payload.actual_end_date),
    objectives,
    milestones,
    participation_type: participationType,
    participation_question: participationType === "none" ? "" : payload.participation_question ?? payload.participationQuestion ?? "",
    participation_options: participationType === "none" ? {} : optionsObject(payload.participation_options ?? payload.participationOptions, participationType),
    participation_opens_at: participationType === "none" ? null : toIso(payload.participation_opens_at),
    participation_closes_at: participationType === "none" ? null : toIso(payload.participation_closes_at ?? payload.decision_closes_at),
    support_enabled: Boolean(payload.support_enabled ?? payload.supportEnabled),
    is_published: payload.is_published ?? payload.isPublished ?? true,
  };
}

/* Public / citizen */
export async function getMunicipalProjects({ force = false } = {}) {
  const load = async () => {
    const { data } = await api.get("/city/projects/", { skipAccessToken: true });
    return unwrapList(data).map(normalizeMunicipalProject);
  };
  return force ? load() : cachedRequest("projects:public:list", load, { ttl: 60_000 });
}

export async function getMunicipalProject(slug, { force = false } = {}) {
  const load = async () => {
    const { data } = await api.get(`/city/projects/${encodeURIComponent(slug)}/`, { skipAccessToken: true });
    return normalizeMunicipalProject(data);
  };
  return force ? load() : cachedRequest(`projects:public:item:${slug}`, load, { ttl: 60_000 });
}

export async function getMyProjectContribution(projectOrSlug) {
  const slug = typeof projectOrSlug === "object" ? projectOrSlug?.slug : projectOrSlug;
  const { data } = await api.get(`/citizen/projects/${encodeURIComponent(slug)}/participation/`);
  const rows = unwrapList(data);
  const row = rows[0] || (data && !Array.isArray(data) && !data.results ? data : null);
  return row ? normalizeContribution(row) : null;
}

export async function submitProjectContribution(projectOrSlug, _citizen, payload = {}) {
  const slug = typeof projectOrSlug === "object" ? projectOrSlug?.slug : projectOrSlug;
  const { data } = await api.post(`/citizen/projects/${encodeURIComponent(slug)}/participation/`, {
    choice: payload.choice,
    comment: payload.comment || "",
  });
  invalidateCache(`projects:public:item:${slug}`);
  if (data?.reference || data?.project_slug || data?.confirmation) return normalizeContribution(data);
  const receipt = await getMyProjectContribution(slug);
  return receipt || normalizeContribution(data);
}

export async function getProjectSupport(projectOrSlug) {
  const slug = typeof projectOrSlug === "object" ? projectOrSlug?.slug : projectOrSlug;
  const { data } = await api.get(`/citizen/projects/${encodeURIComponent(slug)}/support/`);
  const rows = unwrapList(data);
  const row = rows[0] || (data && !Array.isArray(data) && !data.results ? data : {});
  return {
    supported: booleanish(row?.supported),
    supportCount: Number(row?.support_count || 0),
    supportedAt: row?.supported_at || "",
    message: row?.message || "",
  };
}

export async function setProjectSupport(projectOrSlug, supported) {
  const slug = typeof projectOrSlug === "object" ? projectOrSlug?.slug : projectOrSlug;
  const endpoint = `/citizen/projects/${encodeURIComponent(slug)}/support/`;
  const response = supported ? await api.post(endpoint, {}) : await api.delete(endpoint);
  invalidateCache(`projects:public:item:${slug}`);
  if (!supported && !response?.data) return { supported: false, supportCount: 0, supportedAt: "", message: "Soutien retiré." };
  const row = response?.data || {};
  return {
    supported: booleanish(row.supported, supported),
    supportCount: Number(row.support_count || 0),
    supportedAt: row.supported_at || "",
    message: row.message || "",
  };
}

export async function submitCitizenIdea(_citizen, payload = {}) {
  const { data } = await api.post("/citizen/ideas/", {
    ...(payload.project_slug || payload.projectSlug ? { project_slug: payload.project_slug || payload.projectSlug } : {}),
    title: payload.title,
    category: payload.category,
    district: payload.district || "",
    description: payload.description,
  });
  return normalizeIdea(data);
}

export async function getCitizenIdeas() {
  const { data } = await api.get("/citizen/ideas/");
  return unwrapList(data).map(normalizeIdea);
}

export async function getCitizenIdea(reference) {
  const { data } = await api.get(`/citizen/ideas/${encodeURIComponent(reference)}/`);
  return normalizeIdea(data);
}

/* Administration */
export async function getAdminMunicipalProjects() {
  const { data } = await api.get("/admin/projects/");
  return unwrapList(data).map(normalizeMunicipalProject);
}

export async function getAdminMunicipalProject(slug) {
  const { data } = await api.get(`/admin/projects/${encodeURIComponent(slug)}/`);
  return normalizeMunicipalProject(data);
}

export async function createAdminMunicipalProject(payload) {
  const { data } = await api.post("/admin/projects/", projectPayload(payload));
  invalidateCache("projects:");
  return normalizeMunicipalProject(data);
}

export async function updateAdminMunicipalProject(slug, payload) {
  const { data } = await api.patch(`/admin/projects/${encodeURIComponent(slug)}/`, projectPayload(payload));
  invalidateCache("projects:");
  return normalizeMunicipalProject(data);
}

export async function deleteAdminMunicipalProject(slug) {
  await api.delete(`/admin/projects/${encodeURIComponent(slug)}/`);
  invalidateCache("projects:");
  return true;
}

export async function saveMunicipalProject(payload = {}) {
  if (payload.slug) return updateAdminMunicipalProject(payload.slug, payload);
  return createAdminMunicipalProject(payload);
}

export async function getAllProjectContributions() {
  const { data } = await api.get("/admin/project-participations/");
  return unwrapList(data).map(normalizeContribution);
}

export async function getAllCitizenIdeas() {
  const { data } = await api.get("/admin/ideas/");
  return unwrapList(data).map(normalizeIdea);
}

export async function getAdminCitizenIdea(reference) {
  const { data } = await api.get(`/admin/ideas/${encodeURIComponent(reference)}/`);
  return normalizeIdea(data);
}

export async function updateAdminCitizenIdea(reference, patch = {}) {
  const { data } = await api.patch(`/admin/ideas/${encodeURIComponent(reference)}/`, {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.staff_note !== undefined || patch.staffNote !== undefined ? { staff_note: patch.staff_note ?? patch.staffNote ?? "" } : {}),
  });
  return normalizeIdea(data);
}

export const municipalProjectBackendStatus = {
  mode: "backend",
  publicProjects: "/api/city/projects/",
  citizenParticipation: "/api/citizen/projects/{slug}/participation/",
  citizenIdeas: "/api/citizen/ideas/",
  adminProjects: "/api/admin/projects/",
};
