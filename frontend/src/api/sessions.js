import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

function cleanTarget(target = {}) {
  const body = {};

  if (target.session_id) body.session_id = String(target.session_id);
  if (target.all_other_sessions) body.all_other_sessions = true;
  if (target.all_sessions) body.all_sessions = true;

  return body;
}

export function normalizeAccountSession(item = {}) {
  const device = item.device && typeof item.device === "object" ? item.device : {};

  return {
    ...item,
    id: item.id || item.session_id || item.uuid || "",
    createdAt: item.created_at || "",
    createdLabel: formatDateTime(item.created_at, { withYear: true }),
    lastSeenAt: item.last_seen_at || "",
    lastSeenLabel: formatDateTime(item.last_seen_at, { withYear: true }),
    expiresAt: item.expires_at || "",
    expiresLabel: formatDateTime(item.expires_at, { withYear: true }),
    revokedAt: item.revoked_at || "",
    revokeReason: item.revoke_reason || "",
    ipAddress: item.ip_address || "",
    userAgent: item.user_agent || "",
    isCurrent: Boolean(item.is_current),
    isNewDeviceLogin: Boolean(item.is_new_device_login),
    status: item.status || (item.revoked_at ? "revoked" : "active"),
    device: {
      ...device,
      id: device.id || "",
      label: device.label || "Appareil inconnu",
      firstSeenAt: device.first_seen_at || "",
      firstSeenLabel: formatDateTime(device.first_seen_at, { withYear: true }),
      lastSeenAt: device.last_seen_at || "",
      lastSeenLabel: formatDateTime(device.last_seen_at, { withYear: true }),
      lastLoginAt: device.last_login_at || "",
      lastLoginLabel: formatDateTime(device.last_login_at, { withYear: true }),
    },
  };
}

export async function getAccountSessions(params = {}) {
  const rows = [];
  let page = 1;

  for (let guard = 0; guard < 100; guard += 1) {
    const { data } = await api.get("/account/sessions/", {
      params: {
        ...params,
        page,
        page_size: params.page_size || 100,
      },
    });

    rows.push(...unwrapList(data).map(normalizeAccountSession));

    if (!data?.next || !Array.isArray(data?.results)) break;
    page += 1;
  }

  return rows;
}

export async function logoutCurrentAccountSession() {
  await api.post("/account/sessions/current/logout/");
  return true;
}

export async function requestSessionRevocation(target = {}) {
  const body = cleanTarget(target);

  if (!body.session_id && !body.all_other_sessions && !body.all_sessions) {
    throw new Error("Aucune session à révoquer n’a été sélectionnée.");
  }

  const { data } = await api.post("/account/sessions/revoke/request/", body);

  return {
    emailChallengeId: data?.email_challenge_id || data?.emailChallengeId || "",
    expiresIn: Number(data?.expires_in || data?.expiresIn || 300),
    message: data?.message || "Code de sécurité envoyé.",
  };
}

export async function confirmSessionRevocation({
  emailChallengeId,
  emailCode,
  ...target
} = {}) {
  const body = {
    email_challenge_id: emailChallengeId,
    email_code: String(emailCode || "").trim(),
    ...cleanTarget(target),
  };

  if (!body.email_challenge_id) {
    throw new Error("Le challenge de sécurité n’est plus disponible.");
  }
  if (!body.email_code) {
    throw new Error("Saisissez le code reçu par e-mail.");
  }

  const { data } = await api.post("/account/sessions/revoke/confirm/", body);

  return {
    revokedCount: Number(data?.revoked_count || 0),
    requiresRelogin: Boolean(data?.requires_relogin),
  };
}
