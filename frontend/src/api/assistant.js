import { api } from "./api.js";


const LOCAL_CAPABILITIES = {
  available: false,
  source: "fallback",
  intents: ["service_orientation", "report_prefill", "emergency_detection", "municipal_guidance"],
  examples: [
    "Un lampadaire est cassé devant mon immeuble",
    "Je cherche un acte de naissance",
    "Il y a une fuite d’eau dans ma rue",
    "Je veux connaître les transports disponibles",
  ],
};

function assistantUnavailable(error) {
  const status = Number(error?.response?.status || 0);
  return !error?.response || status === 404 || status === 405 || status === 408 || status === 429 || status === 501 || status >= 500;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function number01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizePath(path, { serviceSlug = "", reportCategory = "", message = "" } = {}) {
  let target = text(path);
  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      const url = new URL(target);
      target = `${url.pathname}${url.search}`;
    } catch {
      target = "";
    }
  }
  if (target.startsWith("/api/")) target = "";
  if (/^\/services\//.test(target)) target = `/citizen${target}`;
  if (/^\/reports(?:\/|\?|$)/.test(target) || /^\/signalements(?:\/|\?|$)/.test(target)) {
    target = target.replace(/^\/(?:reports|signalements)/, "/citizen/signalements");
  }
  if (target && !target.startsWith("/citizen/")) target = "";

  if (!target && reportCategory) {
    const params = new URLSearchParams();
    params.set("category", reportCategory);
    if (message) params.set("message", message);
    target = `/citizen/signalements?${params.toString()}`;
  }
  if (!target && serviceSlug) target = `/citizen/services/${encodeURIComponent(serviceSlug)}`;
  return target || "/citizen/services";
}

export function normalizeAssistantOrientation(data = {}, originalMessage = "") {
  const root = data?.result && typeof data.result === "object" ? data.result : data;
  const recommendation = root?.recommendation && typeof root.recommendation === "object" ? root.recommendation : {};
  const service = first(root.service, root.suggested_service, recommendation.service);
  const serviceSlug = text(first(
    root.service_slug,
    root.suggested_service_slug,
    service?.slug,
    recommendation.service_slug,
    recommendation.service?.slug,
  ));
  const reportCategory = text(first(
    root.report_category,
    root.incident_category,
    root.category_code,
    recommendation.report_category,
    recommendation.incident_category,
  ));
  const emergency = Boolean(first(root.emergency, root.is_emergency, recommendation.emergency, recommendation.is_emergency, false));
  const confidence = number01(first(root.confidence, root.score, root.confidence_score, recommendation.confidence));
  const message = text(first(root.prefill_message, root.message, recommendation.prefill_message, originalMessage));
  const rawSuggestions = first(root.suggestions, recommendation.suggestions, []);
  const suggestions = Array.isArray(rawSuggestions)
    ? rawSuggestions.map((item) => typeof item === "string" ? { label: item } : item).filter(Boolean).slice(0, 4)
    : [];
  const path = normalizePath(first(root.path, root.route, root.url, root.action_url, recommendation.path, recommendation.route), {
    serviceSlug,
    reportCategory,
    message,
  });

  return {
    source: "backend",
    title: text(first(root.title, root.intent_label, recommendation.title)) || (emergency ? "Signalement prioritaire" : "Orientation proposée"),
    answer: text(first(root.answer, root.explanation, root.reason, root.detail, recommendation.answer, recommendation.explanation)) || "Voici le parcours qui semble le plus adapté à votre besoin.",
    confidence,
    emergency,
    fallback: Boolean(first(root.fallback, root.used_fallback, false)),
    serviceSlug,
    serviceName: text(first(root.service_name, service?.name, recommendation.service_name, recommendation.service?.name)),
    reportCategory,
    path,
    actionLabel: text(first(root.action_label, recommendation.action_label)) || (reportCategory ? "Préremplir le signalement" : "Ouvrir le service"),
    suggestions,
    raw: data,
  };
}

const FALLBACK_RULES = [
  { rx: /incend|feu|fumee|fumée/, code: "fire_emergency", emergency: true, title: "Incendie / départ de feu" },
  { rx: /urgence medical|urgence médicale|malaise|bless|accident grave/, code: "medical_emergency", emergency: true, title: "Urgence médicale" },
  { rx: /danger immediat|danger immédiat|electroc|électroc|effondr|menace grave/, code: "immediate_danger", emergency: true, title: "Danger immédiat" },
  { rx: /lampadaire|eclairage|éclairage|lumiere|lumière/, code: "street_lighting", title: "Éclairage public" },
  { rx: /fuite|canalis|eau/, code: "water_leak", title: "Eau et fuite" },
  { rx: /dechet|déchet|ordure|proprete|propreté|poubelle/, code: "waste", title: "Déchets et propreté" },
  { rx: /nid.?de.?poule|chauss|route|trottoir|voirie/, code: "road_damage", title: "Voirie et chaussée" },
  { rx: /arbre|parc|espace vert|jardin/, code: "green_spaces", title: "Espaces verts" },
  { rx: /accessibil|fauteuil|rampe|pmr/, code: "accessibility", title: "Accessibilité" },
  { rx: /securit|sécurit|agression|danger public/, code: "public_safety", title: "Sécurité de l’espace public" },
  { rx: /batiment|bâtiment|equipement municipal|équipement municipal/, code: "building", title: "Bâtiment municipal" },
  { rx: /signalement|signaler|incident|probleme dans la rue|probleme public/, code: "other", title: "Autre signalement" },
];

const SERVICE_RULES = [
  { rx: /acte|naissance|mariage|deces|décès|etat civil|état civil|document administratif/, slug: "administration", title: "Administration" },
  { rx: /bus|transport|mobilit|abonnement|ligne|horaire/, slug: "transport", title: "Transport" },
  { rx: /sante|santé|medecin|médecin|consultation/, slug: "sante", title: "Santé" },
  { rx: /logement|habitat|permis de construire/, slug: "habitat", title: "Habitat" },
  { rx: /energie|énergie|electric|électric/, slug: "energie", title: "Énergie" },
  { rx: /securite|sécurité/, slug: "securite", title: "Sécurité" },
];

export function fallbackCitizenOrientation(message = "") {
  const query = text(message);
  const normalized = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const report = FALLBACK_RULES.find((rule) => rule.rx.test(normalized));
  if (report) {
    const params = new URLSearchParams({ category: report.code, message: query });
    return {
      source: "fallback",
      title: report.title,
      answer: report.emergency
        ? "Ce besoin ressemble à une situation prioritaire. Le formulaire sera prérempli et marqué critique. En cas de danger vital immédiat, utilisez aussi les services d’urgence compétents."
        : "Ce besoin ressemble à un signalement municipal. Le formulaire peut être ouvert avec la bonne catégorie et votre message déjà renseigné.",
      confidence: 0.72,
      emergency: Boolean(report.emergency),
      fallback: true,
      serviceSlug: "",
      serviceName: "",
      reportCategory: report.code,
      path: `/citizen/signalements?${params.toString()}`,
      actionLabel: "Préremplir le signalement",
      suggestions: [
        { label: "Ouvrir le signalement prérempli", path: `/citizen/signalements?${params.toString()}` },
        { label: "Voir les signalements", path: "/citizen/signalements" },
      ],
    };
  }

  const service = SERVICE_RULES.find((rule) => rule.rx.test(normalized));
  if (service) {
    return {
      source: "fallback",
      title: service.title,
      answer: "Ce service municipal semble correspondre à votre besoin. Vous pouvez ouvrir sa fiche pour voir les démarches et informations disponibles.",
      confidence: 0.62,
      emergency: false,
      fallback: true,
      serviceSlug: service.slug,
      serviceName: service.title,
      reportCategory: "",
      path: `/citizen/services/${service.slug}`,
      actionLabel: "Ouvrir le service",
      suggestions: [
        { label: `Ouvrir ${service.title}`, path: `/citizen/services/${service.slug}` },
        { label: "Voir tous les services", path: "/citizen/services" },
      ],
    };
  }

  return {
    source: "fallback",
    title: "Orientation générale",
    answer: "Je n’ai pas identifié un parcours unique avec assez de certitude. Le catalogue des services vous permettra de choisir sans bloquer votre démarche.",
    confidence: 0.35,
    emergency: false,
    fallback: true,
    serviceSlug: "",
    serviceName: "",
    reportCategory: "",
    path: "/citizen/services",
    actionLabel: "Voir tous les services",
    suggestions: [
      { label: "Voir les services", path: "/citizen/services" },
      { label: "Faire un signalement", path: "/citizen/signalements" },
    ],
  };
}

export async function getAssistantCapabilities() {
  try {
    const { data } = await api.get("/assistant/capabilities/", { timeout: 1800 });
    return {
      available: true,
      source: "backend",
      intents: Array.isArray(data?.intents) ? data.intents : Array.isArray(data?.capabilities) ? data.capabilities : [],
      examples: Array.isArray(data?.examples) ? data.examples : [],
      raw: data,
    };
  } catch (error) {
    if (assistantUnavailable(error)) return { ...LOCAL_CAPABILITIES };
    throw error;
  }
}

export async function orientCitizenNeed(message, { locale = "fr" } = {}) {
  const query = text(message);
  if (!query) throw new Error("Décrivez votre besoin avant de lancer l’orientation.");
  try {
    const { data } = await api.post("/assistant/orient/", { message: query, locale }, { timeout: 3500 });
    return normalizeAssistantOrientation(data, query);
  } catch (error) {
    // Le backend est toujours prioritaire. Si la route est absente, indisponible,
    // limitée ou en erreur serveur, l’orientation déterministe du frontend prend le relais.
    // Les erreurs d’authentification/autorisation restent visibles au lieu d’être masquées.
    if (assistantUnavailable(error)) {
      return fallbackCitizenOrientation(query);
    }
    throw error;
  }
}
