import { getProfile } from "./auth.js";
import { getAllCitizenRequests } from "./requests.js";
import { getAllCitizenAppointments } from "./appointments.js";
import { getAllCitizenNotifications } from "./notifications.js";
import { getAllCitizenContactMessages } from "./contact.js";
import { loadAccessibilityPreferences } from "../utils/accessibility.js";
import { getLocale } from "../utils/i18n.js";

function settledValue(result, fallback) {
  return result?.status === "fulfilled" ? result.value : fallback;
}

function settledWarning(result, label) {
  if (result?.status !== "rejected") return null;
  return `${label} : ${result.reason?.response?.data?.detail || result.reason?.message || "indisponible"}`;
}

export async function prepareCitizenDataExport(extraPreferences = {}) {
  const results = await Promise.allSettled([
    getProfile(),
    getAllCitizenRequests({ ordering: "-created_at" }),
    getAllCitizenAppointments({ page_size: 100 }),
    getAllCitizenNotifications({ ordering: "-created_at" }),
    getAllCitizenContactMessages({ ordering: "-created_at" }),
  ]);

  const profile = settledValue(results[0], {});
  const requests = settledValue(results[1], []);
  const appointments = settledValue(results[2], []);
  const notifications = settledValue(results[3], []);
  const messages = settledValue(results[4], []);
  const warnings = [
    settledWarning(results[0], "Profil"),
    settledWarning(results[1], "Demandes"),
    settledWarning(results[2], "Rendez-vous"),
    settledWarning(results[3], "Notifications"),
    settledWarning(results[4], "Messages"),
  ].filter(Boolean);

  const procedures = requests.filter((item) => item.requestType !== "signalement");
  const reports = requests.filter((item) => item.requestType === "signalement");

  return {
    export_version: "1.0",
    generated_at: new Date().toISOString(),
    purpose: "F55 - copie lisible des données personnelles accessibles dans l’espace citoyen",
    profile,
    requests: procedures,
    reports,
    appointments,
    notifications,
    contact_messages: messages,
    preferences: {
      locale: getLocale(),
      accessibility: loadAccessibilityPreferences(),
      ...extraPreferences,
    },
    summary: {
      requests: procedures.length,
      reports: reports.length,
      appointments: appointments.length,
      notifications: notifications.length,
      contact_messages: messages.length,
    },
    warnings,
  };
}
