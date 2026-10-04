import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

const EVENT_META = {
  session_created: { title: "Nouvelle session ouverte", group: "Connexion", tone: "info", icon: "↗" },
  new_device_login: { title: "Connexion depuis un nouvel appareil", group: "Connexion", tone: "warning", icon: "!" },
  session_revoked: { title: "Session révoquée", group: "Session", tone: "warning", icon: "×" },
  sessions_revoked: { title: "Toutes les sessions révoquées", group: "Session", tone: "warning", icon: "×" },
  password_changed: { title: "Mot de passe modifié", group: "Compte", tone: "success", icon: "✓" },
  password_set: { title: "Mot de passe défini", group: "Compte", tone: "success", icon: "✓" },
  password_reset_completed: { title: "Réinitialisation du mot de passe terminée", group: "Compte", tone: "success", icon: "✓" },
  email_change_requested: { title: "Changement d’adresse e-mail demandé", group: "Compte", tone: "info", icon: "@" },
  email_changed: { title: "Adresse e-mail modifiée", group: "Compte", tone: "warning", icon: "@" },
  mfa_enabled: { title: "Double authentification activée", group: "MFA", tone: "success", icon: "✓" },
  mfa_disabled: { title: "Double authentification désactivée", group: "MFA", tone: "danger", icon: "!" },
  mfa_recovery_codes_regenerated: { title: "Codes de récupération renouvelés", group: "MFA", tone: "warning", icon: "#" },
  account_deleted: { title: "Compte supprimé", group: "Compte", tone: "danger", icon: "×" },
};

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function text(value, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

export function normalizeSecurityEvent(item = {}) {
  const kind = text(item.kind, "security_event");
  const meta = EVENT_META[kind] || { title: kind.replaceAll("_", " "), group: "Sécurité", tone: "info", icon: "•" };
  const details = item.details && typeof item.details === "object" ? item.details : {};
  const device = text(details.device_label || details.device || "");
  const ipAddress = text(details.ip_address || details.ip || "");
  const reason = text(details.reason || "");
  const method = text(details.method || "");
  const path = text(details.path || "");
  return {
    ...item,
    id: item.id,
    kind,
    title: meta.title,
    group: meta.group,
    tone: meta.tone,
    icon: meta.icon,
    createdAt: item.created_at || "",
    createdLabel: formatDateTime(item.created_at, { withYear: true }),
    sessionId: item.session_id || "",
    device,
    ipAddress,
    reason,
    method,
    path,
    details,
  };
}

export async function getAccountSecurityEvents(params = {}) {
  const { data } = await api.get("/account/security/events/", { params: cleanParams(params) });
  const results = unwrapList(data).map(normalizeSecurityEvent);
  return {
    count: Number(data?.count ?? results.length),
    next: data?.next || null,
    previous: data?.previous || null,
    results,
  };
}
