import { api, clearAccessToken, setAccessToken } from "./api.js";

const GOOGLE_REMEMBER_KEY = "nova_terra_google_remember";
const GOOGLE_FLOW_KEY = "nova_terra_google_flow";
const REGISTRATION_CONTEXT_KEY = "nova_terra_registration_context";
const MFA_CONTEXT_KEY = "nova_terra_pending_mfa";
const ACCOUNT_GOOGLE_PROOF_KEY = "nova_terra_account_google_proof";
let bootstrapPromise = null;

function rememberFromSession() {
  return window.sessionStorage.getItem(GOOGLE_REMEMBER_KEY) !== "false";
}

function consumeGoogleRemember() {
  const remember = rememberFromSession();
  window.sessionStorage.removeItem(GOOGLE_REMEMBER_KEY);
  return remember;
}

function toFormData(values = {}) {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, typeof value === "boolean" ? String(value) : value);
  });
  return form;
}

function rememberPendingMfa(data, source = "login") {
  if (!data?.mfa_required || !data?.mfa_token) return null;
  const context = {
    mfa_token: data.mfa_token,
    methods: Array.isArray(data.methods) ? data.methods : [],
    expires_in: Number(data.expires_in || 300),
    source,
    created_at: Date.now(),
  };
  window.sessionStorage.setItem(MFA_CONTEXT_KEY, JSON.stringify(context));
  return context;
}

export function getPendingMfa() {
  const raw = window.sessionStorage.getItem(MFA_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const context = JSON.parse(raw);
    const ttl = Math.max(30, Number(context?.expires_in || 300)) * 1000;
    if (!context?.mfa_token || Date.now() - Number(context.created_at || 0) > ttl) {
      window.sessionStorage.removeItem(MFA_CONTEXT_KEY);
      return null;
    }
    return context;
  } catch {
    window.sessionStorage.removeItem(MFA_CONTEXT_KEY);
    return null;
  }
}

export function clearPendingMfa() {
  window.sessionStorage.removeItem(MFA_CONTEXT_KEY);
}

function applyAuthenticatedSession(data) {
  if (!data?.access || !data?.user) return false;
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  clearPendingMfa();
  return true;
}

export function getApiErrorMessage(error, fallback = "Une erreur est survenue.") {
  const data = error?.response?.data;
  if (!data) {
    if (error?.code === "ECONNABORTED") return "Le serveur met trop de temps à répondre.";
    return fallback;
  }
  if (error?.response?.status === 403 && /csrf/i.test(String(data?.detail || data || ""))) {
    return "La session de sécurité a expiré. Réessayez la connexion.";
  }

  const candidates = [];
  if (typeof data.detail === "string" && data.detail !== "Données invalides.") {
    candidates.push(data.detail);
  }

  const errors = data.errors;
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors)) {
      if (Array.isArray(value)) candidates.push(...value.map(String));
      else if (typeof value === "string") candidates.push(value);
      else if (value && typeof value === "object") {
        for (const nested of Object.values(value)) {
          if (Array.isArray(nested)) candidates.push(...nested.map(String));
          else if (nested) candidates.push(String(nested));
        }
      }
    }
  }

  return candidates.find(Boolean) || data.detail || fallback;
}

export function isEmailNotVerifiedError(error) {
  const data = error?.response?.data || {};
  const value = data?.errors?.email;
  const text = [
    data?.detail,
    Array.isArray(value) ? value.join(" ") : value,
  ].filter(Boolean).join(" ").toLowerCase();
  return (
    text.includes("non vérifi") ||
    text.includes("non verifi") ||
    text.includes("not verified") ||
    text.includes("verify your email")
  );
}

export async function login({ email, password, remember }) {
  clearPendingMfa();
  const { data } = await api.post(
    "/auth/login/",
    toFormData({ email, password, remember }),
    { skipAuthRefresh: true, skipAccessToken: true, csrf: true },
  );
  if (data?.mfa_required) rememberPendingMfa(data, "password");
  else applyAuthenticatedSession(data);
  return data;
}

export async function register(payload) {
  const { data } = await api.post("/auth/register/", toFormData(payload), {
    skipAuthRefresh: true,
    skipAccessToken: true,
  });
  if (data?.registration_token) {
    window.localStorage.setItem(REGISTRATION_CONTEXT_KEY, JSON.stringify({
      token: data.registration_token,
      email: payload?.email || data?.user?.email || "",
      first_name: payload?.first_name || data?.user?.first_name || "",
      last_name: payload?.last_name || data?.user?.last_name || "",
      created_at: Date.now(),
    }));
  }
  return data;
}

export function getRegistrationContext() {
  const raw = window.localStorage.getItem(REGISTRATION_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value?.token) return null;
    const maxAge = 24 * 60 * 60 * 1000;
    if (value.created_at && Date.now() - Number(value.created_at) > maxAge) {
      window.localStorage.removeItem(REGISTRATION_CONTEXT_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearRegistrationContext() {
  window.localStorage.removeItem(REGISTRATION_CONTEXT_KEY);
}

export async function completeRegistrationProfile(payload = {}) {
  const context = getRegistrationContext();
  const registrationToken = payload.registration_token || context?.token;
  if (!registrationToken) {
    throw new Error("Le jeton d’inscription n’est plus disponible. Vous pourrez compléter votre profil depuis votre espace citoyen.");
  }

  const body = {
    registration_token: registrationToken,
    first_name: payload.first_name,
    last_name: payload.last_name,
    profession: payload.profession,
    gender: payload.gender,
    birth_date: payload.birth_date,
    phone_number: payload.phone_number,
    address: payload.address,
    habitat: payload.habitat,
    district: payload.district,
    sector: payload.sector,
    street: payload.street,
    building: payload.building,
    apartment: payload.apartment,
  };
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined || body[key] === null || body[key] === "") delete body[key];
  });
  const { data } = await api.post(
    "/auth/register/profile/",
    toFormData(body),
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  clearRegistrationContext();
  return data;
}

export async function startGoogleAuth({
  remember = true,
  returnTo = "",
  purpose = "login",
  expectedUserId = null,
} = {}) {
  window.sessionStorage.setItem(GOOGLE_REMEMBER_KEY, String(Boolean(remember)));

  if (returnTo || purpose !== "login" || expectedUserId !== null) {
    window.sessionStorage.setItem(
      GOOGLE_FLOW_KEY,
      JSON.stringify({
        returnTo,
        purpose,
        expectedUserId,
        startedAt: Date.now(),
      }),
    );
  } else {
    window.sessionStorage.removeItem(GOOGLE_FLOW_KEY);
  }

  await api.get("/auth/csrf/", {
    skipAuthRefresh: true,
    skipAccessToken: true,
  });
  const { data } = await api.get("/auth/google/redirect/", {
    skipAuthRefresh: true,
    skipAccessToken: true,
  });
  if (!data?.authorization_url) throw new Error("Le backend n’a pas retourné l’URL Google.");
  window.location.assign(data.authorization_url);
}

export function getGoogleFlow() {
  const raw = window.sessionStorage.getItem(GOOGLE_FLOW_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGoogleFlow() {
  window.sessionStorage.removeItem(GOOGLE_FLOW_KEY);
}



export function storeAccountGoogleProof({ purpose, code, state }) {
  window.sessionStorage.setItem(
    ACCOUNT_GOOGLE_PROOF_KEY,
    JSON.stringify({ purpose, code, state, createdAt: Date.now() }),
  );
}

export function getAccountGoogleProof(maxAgeMs = 5 * 60 * 1000) {
  const raw = window.sessionStorage.getItem(ACCOUNT_GOOGLE_PROOF_KEY);
  if (!raw) return null;
  try {
    const proof = JSON.parse(raw);
    if (!proof?.code || !proof?.state || Date.now() - Number(proof.createdAt || 0) > maxAgeMs) {
      window.sessionStorage.removeItem(ACCOUNT_GOOGLE_PROOF_KEY);
      return null;
    }
    return proof;
  } catch {
    window.sessionStorage.removeItem(ACCOUNT_GOOGLE_PROOF_KEY);
    return null;
  }
}

export function clearAccountGoogleProof() {
  window.sessionStorage.removeItem(ACCOUNT_GOOGLE_PROOF_KEY);
}

export async function completeGoogleAuth({ code, state }) {
  clearPendingMfa();
  const { data } = await api.post(
    "/auth/google/",
    toFormData({ code, state, remember: consumeGoogleRemember() }),
    { skipAuthRefresh: true, skipAccessToken: true, csrf: true },
  );
  if (data?.mfa_required) rememberPendingMfa(data, "google");
  else applyAuthenticatedSession(data);
  return data;
}

export async function sendAuthMfaEmail(mfaToken) {
  const { data } = await api.post(
    "/auth/mfa/email/send/",
    { mfa_token: mfaToken },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function verifyAuthMfa(payload = {}) {
  const pending = getPendingMfa();
  const mfaToken = payload.mfa_token || pending?.mfa_token;
  if (!mfaToken) throw new Error("Le challenge MFA n’est plus disponible. Reconnectez-vous.");

  const { data } = await api.post(
    "/auth/mfa/verify/",
    toFormData({
      mfa_token: mfaToken,
      mfa_code: payload.mfa_code,
      recovery_code: payload.recovery_code,
      email_code: payload.email_code,
      email_challenge_id: payload.email_challenge_id,
    }),
    { skipAuthRefresh: true, skipAccessToken: true, csrf: true },
  );
  if (!applyAuthenticatedSession(data)) {
    throw new Error("La vérification MFA n’a pas retourné de session valide.");
  }
  return data;
}

export async function verifyEmail({ uid, token }) {
  const { data } = await api.post(
    "/auth/verify-email/",
    toFormData({ uid, token }),
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  applyAuthenticatedSession(data);
  return data;
}

export async function resendVerification(email) {
  const { data } = await api.post(
    "/auth/resend-verification/",
    toFormData({ email }),
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await api.post(
    "/auth/password-reset/",
    toFormData({ email }),
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function confirmPasswordReset({ uid, token, newPassword, newPasswordConfirm }) {
  const { data } = await api.post(
    "/auth/password-reset/confirm/",
    toFormData({
      uid,
      token,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    }),
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function getProfile() {
  const { data } = await api.get("/account/profile/");
  return data;
}

export async function bootstrapSession() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const { refreshAccessToken } = await import("./api.js");
        await refreshAccessToken();
        return await getProfile();
      } catch {
        clearAccessToken();
        return null;
      }
    })();
  }
  return bootstrapPromise;
}

export function invalidateSessionBootstrap() {
  bootstrapPromise = null;
}

export async function logout() {
  try {
    await api.post("/auth/logout/", undefined, {
      skipAuthRefresh: true,
      skipAccessToken: true,
      csrf: true,
    });
  } finally {
    clearAccessToken();
    invalidateSessionBootstrap();
  }
}
