const PROJECTS_KEY = "nova-terra:projects:v1";
const CONTRIBUTIONS_KEY = "nova-terra:project-contributions:v1";
const IDEAS_KEY = "nova-terra:citizen-ideas:v1";

const SEED_PROJECTS = [
  {
    id: "PRJ-001",
    slug: "parc-urbain-nova-centre",
    title: "Parc urbain Nova Centre",
    summary: "Création d’un nouvel espace vert et d’une zone piétonne au cœur de Nova Terra.",
    description: "Le projet transforme le secteur central en un espace plus végétalisé, accessible et agréable à parcourir à pied. Il prévoit des zones ombragées, des espaces de rencontre et de nouveaux cheminements piétons.",
    district: "Nova Centre",
    status: "in_progress",
    progress: 70,
    start_date: "2026-03-01",
    expected_end_date: "2026-11-30",
    participation_type: "consultation",
    participation_question: "Que pensez-vous de l’aménagement proposé pour le parc urbain Nova Centre ?",
    objectives: ["Créer un espace vert de proximité", "Améliorer les déplacements piétons", "Créer des espaces de rencontre accessibles"],
    milestones: [
      { title: "Étude et concertation initiale", status: "completed" },
      { title: "Travaux préparatoires", status: "completed" },
      { title: "Aménagement des espaces verts", status: "current" },
      { title: "Installation du mobilier urbain", status: "upcoming" },
    ],
    updated_at: "2026-10-03T18:00:00+03:00",
  },
  {
    id: "PRJ-002",
    slug: "mobilite-corridor-est",
    title: "Mobilité du Corridor Est",
    summary: "Réorganisation des déplacements entre les quartiers Est et le centre avec une piste cyclable continue.",
    description: "Nova Terra étudie une liaison cyclable protégée et de nouveaux points de traversée afin de réduire les conflits entre véhicules, piétons et cyclistes.",
    district: "District Orion",
    status: "consultation",
    progress: 42,
    start_date: "2026-06-15",
    expected_end_date: "2027-02-28",
    participation_type: "decision",
    participation_question: "Faut-il intégrer une piste cyclable protégée sur toute la longueur du Corridor Est ?",
    decision_closes_at: "2026-10-08T20:00:00+03:00",
    objectives: ["Sécuriser les déplacements actifs", "Réduire les temps de trajet courts", "Améliorer les connexions entre quartiers"],
    milestones: [
      { title: "Diagnostic de circulation", status: "completed" },
      { title: "Scénarios techniques", status: "completed" },
      { title: "Décision citoyenne", status: "current" },
      { title: "Conception détaillée", status: "upcoming" },
    ],
    updated_at: "2026-10-03T19:20:00+03:00",
  },
  {
    id: "PRJ-003",
    slug: "centre-sante-aster",
    title: "Centre de santé Aster",
    summary: "Extension du centre de santé de proximité et amélioration de l’accueil des urgences légères.",
    description: "Le projet augmente la capacité d’accueil du quartier Aster et améliore l’accessibilité des espaces de consultation.",
    district: "Quartier Aster",
    status: "in_progress",
    progress: 58,
    start_date: "2026-01-20",
    expected_end_date: "2026-12-18",
    participation_type: "none",
    participation_question: "",
    objectives: ["Augmenter la capacité d’accueil", "Améliorer l’accessibilité", "Créer un parcours d’orientation plus simple"],
    milestones: [
      { title: "Études techniques", status: "completed" },
      { title: "Extension du bâtiment", status: "current" },
      { title: "Équipement des salles", status: "upcoming" },
      { title: "Ouverture au public", status: "upcoming" },
    ],
    updated_at: "2026-10-02T16:45:00+03:00",
  },
];

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("nova-terra-projects-change", { detail: { key } }));
  return value;
}

function ensureProjects() {
  const current = readJson(PROJECTS_KEY, null);
  if (Array.isArray(current) && current.length) return current;
  writeJson(PROJECTS_KEY, SEED_PROJECTS);
  return SEED_PROJECTS;
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `projet-${Date.now()}`;
}

function citizenKey(citizen = {}) {
  return String(citizen.id || citizen.email || citizen.username || "citizen-demo");
}

function nextReference(prefix, rows) {
  const year = new Date().getFullYear();
  const seq = rows.length + 1;
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

export async function getMunicipalProjects() {
  return ensureProjects().map((item) => ({ ...item }));
}

export async function getMunicipalProject(idOrSlug) {
  const rows = ensureProjects();
  const project = rows.find((item) => String(item.id) === String(idOrSlug) || item.slug === idOrSlug);
  if (!project) throw new Error("Projet municipal introuvable.");
  return { ...project };
}

export async function saveMunicipalProject(payload = {}) {
  const rows = ensureProjects();
  const existingIndex = rows.findIndex((item) => String(item.id) === String(payload.id) || item.slug === payload.slug);
  const existing = existingIndex >= 0 ? rows[existingIndex] : null;
  const id = existing?.id || `PRJ-${String(rows.length + 1).padStart(3, "0")}`;
  const next = {
    id,
    slug: existing?.slug || slugify(payload.title),
    title: payload.title || existing?.title || "Nouveau projet",
    summary: payload.summary || existing?.summary || "",
    description: payload.description || existing?.description || "",
    district: payload.district || existing?.district || "Nova Centre",
    status: payload.status || existing?.status || "planned",
    progress: Math.max(0, Math.min(100, Number(payload.progress ?? existing?.progress ?? 0))),
    start_date: payload.start_date || existing?.start_date || "",
    expected_end_date: payload.expected_end_date || existing?.expected_end_date || "",
    participation_type: payload.participation_type || existing?.participation_type || "none",
    participation_question: payload.participation_question ?? existing?.participation_question ?? "",
    decision_closes_at: payload.decision_closes_at ?? existing?.decision_closes_at ?? "",
    objectives: Array.isArray(payload.objectives) ? payload.objectives : existing?.objectives || [],
    milestones: Array.isArray(payload.milestones) ? payload.milestones : existing?.milestones || [],
    updated_at: new Date().toISOString(),
  };
  const updated = [...rows];
  if (existingIndex >= 0) updated[existingIndex] = next;
  else updated.unshift(next);
  writeJson(PROJECTS_KEY, updated);
  return { ...next };
}

export async function submitProjectContribution(project, citizen, payload = {}) {
  const rows = readJson(CONTRIBUTIONS_KEY, []);
  const userKey = citizenKey(citizen);
  const contributionType = payload.type || project.participation_type || "consultation";
  const previousIndex = rows.findIndex((item) => item.project_id === project.id && item.citizen_key === userKey && item.type === contributionType);
  const previous = previousIndex >= 0 ? rows[previousIndex] : null;
  const contribution = {
    id: previous?.id || `${project.id}-${userKey}-${contributionType}`,
    reference: previous?.reference || nextReference(contributionType === "decision" ? "PART" : "AVIS", rows),
    project_id: project.id,
    project_slug: project.slug,
    project_title: project.title,
    citizen_key: userKey,
    citizen_name: citizen?.display_name || `${citizen?.first_name || ""} ${citizen?.last_name || ""}`.trim() || citizen?.email || "Citoyen",
    citizen_email: citizen?.email || "",
    type: contributionType,
    choice: payload.choice || "",
    comment: payload.comment || "",
    created_at: previous?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const updated = [...rows];
  if (previousIndex >= 0) updated[previousIndex] = contribution;
  else updated.unshift(contribution);
  writeJson(CONTRIBUTIONS_KEY, updated);
  return { ...contribution };
}

export async function getMyProjectContribution(projectId, citizen) {
  const rows = readJson(CONTRIBUTIONS_KEY, []);
  const userKey = citizenKey(citizen);
  const row = rows.find((item) => item.project_id === projectId && item.citizen_key === userKey);
  return row ? { ...row } : null;
}

export async function getAllProjectContributions() {
  return readJson(CONTRIBUTIONS_KEY, []).map((item) => ({ ...item }));
}

export async function submitCitizenIdea(citizen, payload = {}) {
  const rows = readJson(IDEAS_KEY, []);
  const idea = {
    id: `idea-${Date.now()}`,
    reference: nextReference("IDEA", rows),
    citizen_key: citizenKey(citizen),
    citizen_name: citizen?.display_name || `${citizen?.first_name || ""} ${citizen?.last_name || ""}`.trim() || citizen?.email || "Citoyen",
    citizen_email: citizen?.email || "",
    title: payload.title || "Idée citoyenne",
    category: payload.category || "Autre",
    district: payload.district || "Nova Centre",
    description: payload.description || "",
    status: "submitted",
    created_at: new Date().toISOString(),
  };
  writeJson(IDEAS_KEY, [idea, ...rows]);
  return { ...idea };
}

export async function getCitizenIdeas(citizen) {
  const key = citizenKey(citizen);
  return readJson(IDEAS_KEY, []).filter((item) => item.citizen_key === key).map((item) => ({ ...item }));
}

export async function getAllCitizenIdeas() {
  return readJson(IDEAS_KEY, []).map((item) => ({ ...item }));
}

export const municipalProjectBackendStatus = {
  mode: "local-fallback",
  reason: "Aucun endpoint projets/participation n’est documenté dans l’API Nova Terra actuellement disponible.",
};
