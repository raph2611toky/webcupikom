
const STORAGE_KEY = "nova_terra_locale";

export const SUPPORTED_LOCALES = ["fr", "en"];

export const UI_TEXT = {
  fr: {
    home: "Accueil",
    services: "Services",
    news: "Actualités",
    contact: "Contact",
    dashboard: "Tableau de bord",
    profile: "Mon profil",
    requests: "Mes demandes",
    notifications: "Notifications",
    messages: "Mes messages",
    settings: "Paramètres",
    help: "Besoin d’aide",
    logout: "Déconnexion",
    citizenSpace: "Espace citoyen",
    agentSpace: "Espace agent",
    adminSpace: "Administration",
    newRequest: "Nouvelle demande",
    quickServices: "Services prioritaires",
    followNow: "À suivre maintenant",
    allServices: "Tous les services",
    allRequests: "Tout voir",
    currentRequests: "Démarches en cours",
    actionRequired: "Action requise",
    latestNews: "Actualités",
    loading: "Chargement…",
    language: "Langue",
  },
  en: {
    home: "Home",
    services: "Services",
    news: "News",
    contact: "Contact",
    dashboard: "Dashboard",
    profile: "My profile",
    requests: "My requests",
    notifications: "Notifications",
    messages: "My messages",
    settings: "Settings",
    help: "Need help",
    logout: "Sign out",
    citizenSpace: "Citizen space",
    agentSpace: "Agent space",
    adminSpace: "Administration",
    newRequest: "New request",
    quickServices: "Priority services",
    followNow: "Track now",
    allServices: "All services",
    allRequests: "View all",
    currentRequests: "Open requests",
    actionRequired: "Action required",
    latestNews: "News",
    loading: "Loading…",
    language: "Language",
  },
};

export function getLocale() {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LOCALES.includes(stored) ? stored : "fr";
}

export function setLocale(locale) {
  const next = SUPPORTED_LOCALES.includes(locale) ? locale : "fr";
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent("nova-locale-change", { detail: next }));
  }
  return next;
}

export function syncLocaleFromUser(user) {
  if (user?.locale && SUPPORTED_LOCALES.includes(user.locale)) return setLocale(user.locale);
  const current = getLocale();
  if (typeof document !== "undefined") document.documentElement.lang = current;
  return current;
}

export function t(key, locale = getLocale()) {
  return UI_TEXT[locale]?.[key] ?? UI_TEXT.fr[key] ?? key;
}
