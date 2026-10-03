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

export async function changePassword({ currentPassword, newPassword, confirmation }) {
  const { data } = await api.post("/account/change-password/", {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirm: confirmation,
  });
  return data;
}

export async function setPassword({ newPassword, confirmation }) {
  const { data } = await api.post("/account/set-password/", {
    new_password: newPassword,
    new_password_confirm: confirmation,
  });
  return data;
}

export async function requestEmailChange({ newEmail, currentPassword = "" }) {
  const { data } = await api.post("/account/change-email/", {
    new_email: newEmail,
    current_password: currentPassword,
  });
  return data;
}

export async function confirmEmailChange(token) {
  const { data } = await api.post("/account/change-email/confirm/", { token }, { skipAuthRefresh: true });
  return data;
}

export async function deleteAccount({ currentPassword = "", confirmation = "DELETE" }) {
  await api.delete("/account/", { data: { current_password: currentPassword, confirmation } });
}
