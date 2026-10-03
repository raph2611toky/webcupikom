import { api } from "./api.js";
import { unwrapList } from "./helpers.js";

export async function getAdminUsers(params = {}) {
  const { data } = await api.get("/admin/users/", { params });
  return unwrapList(data);
}

export async function createAdminUser(payload) {
  const { data } = await api.post("/admin/users/", payload);
  return data;
}

export async function getAdminUser(id) {
  const { data } = await api.get(`/admin/users/${encodeURIComponent(id)}/`);
  return data;
}

export async function updateAdminUser(id, payload) {
  const { data } = await api.patch(`/admin/users/${encodeURIComponent(id)}/`, payload);
  return data;
}

export async function getAdminSystem() {
  const { data } = await api.get("/admin/system/");
  return data;
}
