import { api } from "./api.js";
import { unwrapList } from "./helpers.js";

export async function getWebcupFeed({ force = false } = {}) {
  const { data } = await api.get("/webcup/requests/", { params: force ? { force: 1 } : undefined });
  return {
    ...data,
    source: data?.meta?.upstream_available === false ? "cache" : "live",
  };
}

export async function getWebcupLocalRequests(params = {}) {
  const { data } = await api.get("/webcup/requests/local/", { params });
  return unwrapList(data);
}

export async function getWebcupStatus() {
  const { data } = await api.get("/webcup/status/");
  return data;
}
