import { api } from "./api.js";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function normalizeNews(item) {
  return {
    ...item,
    date: formatDate(item.published_at),
    body: item.content || "",
  };
}

export async function getNews(params = {}) {
  const { data } = await api.get("/city/news/", { params, skipAccessToken: true });
  return (Array.isArray(data) ? data : data?.results || []).map(normalizeNews);
}

export async function getNewsItem(slug) {
  const { data } = await api.get(`/city/news/${encodeURIComponent(slug)}/`, { skipAccessToken: true });
  return normalizeNews(data);
}
