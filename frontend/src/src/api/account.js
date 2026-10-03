import { api } from "./api.js";

export async function updateProfile(payload) {
  const body = payload instanceof FormData ? payload : (() => {
    const form = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, value);
    });
    return form;
  })();
  const { data } = await api.patch("/account/profile/", body);
  return data;
}

export async function changePassword({ currentPassword, newPassword, confirmation, ...verification }) {
  const { data } = await api.post("/account/change-password/", toFormData({
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirm: confirmation,
    ...verification,
  }));
  return data;
}

export async function setPassword({ newPassword, confirmation, ...verification }) {
  const { data } = await api.post("/account/set-password/", toFormData({
    new_password: newPassword,
    new_password_confirm: confirmation,
    ...verification,
  }));
  return data;
}

export async function requestEmailChange({ newEmail, currentPassword = "", ...verification }) {
  const { data } = await api.post("/account/change-email/", toFormData({
    new_email: newEmail,
    current_password: currentPassword,
    ...verification,
  }));
  return data;
}

export async function confirmEmailChange(token) {
  const { data } = await api.post("/account/change-email/confirm/", { token }, { skipAuthRefresh: true });
  return data;
}

export async function deleteAccount({ currentPassword = "", confirmation = "DELETE", ...verification }) {
  const form = toFormData({
    current_password: currentPassword,
    confirmation,
    ...verification,
  });
  const { data } = await api.delete("/account/", { data: form });
  return data;
}


function toFormData(payload = {}) {
  const form = new FormData();
  Object.entries(payload).forEach(([key,value]) => {
    if (value !== undefined && value !== null && value !== "") form.append(key, value);
  });
  return form;
}

export async function getMfaStatus() {
  const { data } = await api.get("/account/mfa/");
  return data;
}

export async function setupMfa(payload = {}) {
  const { data } = await api.post("/account/mfa/setup/", toFormData(payload));
  return data;
}

export async function confirmMfa(code) {
  const { data } = await api.post("/account/mfa/confirm/", toFormData({ code }));
  return data;
}

export async function disableMfa(payload = {}) {
  const { data } = await api.post("/account/mfa/disable/", toFormData(payload));
  return data;
}

export async function regenerateMfaRecoveryCodes(payload = {}) {
  const { data } = await api.post("/account/mfa/recovery-codes/regenerate/", toFormData(payload));
  return data;
}
