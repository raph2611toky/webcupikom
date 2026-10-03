import { useEffect, useState } from "react";

const KEY = "nova_terra_locale";
const EVENT = "nova-terra-locale-change";

export const SUPPORTED_LOCALES = ["fr", "en", "mg"];
export const LOCALE_LABELS = { fr: "FR", en: "EN", mg: "MG" };
export const LOCALE_NAMES = { fr: "Français", en: "English", mg: "Malagasy" };

export const TEXT = {
  fr: {
    home:"Accueil", dashboard:"Tableau de bord", requests:"Mes demandes", services:"Services", news:"Actualités",
    profile:"Mon profil", notifications:"Notifications", settings:"Paramètres", contact:"Nous contacter", logout:"Déconnexion",
    login:"Se connecter", register:"Créer un compte", mySpace:"Mon espace", language:"Langue", citizenSpace:"Espace citoyen",
    newRequest:"Nouvelle demande", allServices:"Tous les services", allRequests:"Tout voir", priorityServices:"Services prioritaires",
  },
  en: {
    home:"Home", dashboard:"Dashboard", requests:"My requests", services:"Services", news:"News",
    profile:"My profile", notifications:"Notifications", settings:"Settings", contact:"Contact us", logout:"Sign out",
    login:"Sign in", register:"Create account", mySpace:"My space", language:"Language", citizenSpace:"Citizen space",
    newRequest:"New request", allServices:"All services", allRequests:"View all", priorityServices:"Priority services",
  },
  mg: {
    home:"Fandraisana", dashboard:"Tabilao", requests:"Ny fangatahako", services:"Sampan-draharaha", news:"Vaovao",
    profile:"Ny mombamomba ahy", notifications:"Fampahafantarana", settings:"Fikirana", contact:"Hifandray aminay", logout:"Hivoaka",
    login:"Hiditra", register:"Hamorona kaonty", mySpace:"Ny habakako", language:"Fiteny", citizenSpace:"Habaka ho an'ny mponina",
    newRequest:"Fangatahana vaovao", allServices:"Sampan-draharaha rehetra", allRequests:"Hijery rehetra", priorityServices:"Sampan-draharaha laharam-pahamehana",
  },
};

export function hasLocalePreference() {
  return typeof window !== "undefined" && window.localStorage.getItem(KEY) !== null;
}

export function getLocale() {
  if (typeof window === "undefined") return "fr";
  const value = window.localStorage.getItem(KEY);
  return SUPPORTED_LOCALES.includes(value) ? value : "fr";
}

export function setLocale(locale) {
  const next = SUPPORTED_LOCALES.includes(locale) ? locale : "fr";
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, next);
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
  return next;
}

export function seedLocaleFromBackend(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return getLocale();
  if (!hasLocalePreference()) return setLocale(locale);
  return getLocale();
}

export function useLocale() {
  const [locale, setCurrent] = useState(() => getLocale());

  useEffect(() => {
    const onChange = (event) => setCurrent(event?.detail || getLocale());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return [locale, setLocale];
}

export function t(key, locale = getLocale()) {
  return TEXT[locale]?.[key] || TEXT.fr[key] || key;
}
