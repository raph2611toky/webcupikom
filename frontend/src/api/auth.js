import { api, clearAccessToken, setAccessToken } from "./api.js";

const GOOGLE_REMEMBER_KEY = "nova_terra_google_remember";
const GOOGLE_FLOW_KEY = "nova_terra_google_flow";
const REGISTRATION_CONTEXT_KEY = "nova_terra_registration_context";
let bootstrapPromise = null;

function rememberFromSession() {
  return window.sessionStorage.getItem(GOOGLE_REMEMBER_KEY) !== "false";
}

function consumeGoogleRemember() {
  const remember = rememberFromSession();
  window.sessionStorage.removeItem(GOOGLE_REMEMBER_KEY);
  return remember;
}

export function getApiErrorMessage(error, fallback = "Une erreur est survenue.") {
  const data = error?.response?.data;
  if (!data) return fallback;

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
  const value = error?.response?.data?.errors?.email;
  const text = Array.isArray(value) ? value.join(" ") : String(value || "");
  return text.toLowerCase().includes("non vérifiée");
}

export async function login({ email, password, remember }) {
  const { data } = await api.post(
    "/auth/login/",
    { email, password, remember },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  return data;
}

export async function register(payload) {
  const { data } = await api.post("/auth/register/", payload, {
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
    body,
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

  const { data } = await api.get("/auth/google/redirect/", {
    skipAuthRefresh: true,
    skipAccessToken: true,
  });
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

export async function completeGoogleAuth({ code, state }) {
  const { data } = await api.post(
    "/auth/google/",
    { code, state, remember: consumeGoogleRemember() },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  return data;
}

export async function verifyEmail({ uid, token }) {
  const { data } = await api.post(
    "/auth/verify-email/",
    { uid, token },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  setAccessToken(data.access);
  bootstrapPromise = Promise.resolve(data.user);
  return data;
}

export async function resendVerification(email) {
  const { data } = await api.post(
    "/auth/resend-verification/",
    { email },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await api.post(
    "/auth/password-reset/",
    { email },
    { skipAuthRefresh: true, skipAccessToken: true },
  );
  return data;
}

export async function confirmPasswordReset({ uid, token, newPassword, newPasswordConfirm }) {
  const { data } = await api.post(
    "/auth/password-reset/confirm/",
    {
      uid,
      token,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    },
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
    });
  } finally {
    clearAccessToken();
    invalidateSessionBootstrap();
  }
}
