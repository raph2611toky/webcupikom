import { api } from "./api.js";
import { formatDateTime, unwrapList } from "./helpers.js";

export const CONTACT_STATUS_LABEL = Object.freeze({
  received: "Reçu",
  read: "Lu",
  closed: "Clôturé",
});

function normalizeContact(item) {
  return {
    ...item,
    statusCode: item.status,
    statusLabel: CONTACT_STATUS_LABEL[item.status] || item.status,
    createdLabel: formatDateTime(item.created_at),
    updatedLabel: formatDateTime(item.updated_at),
  };
}

export async function sendContactMessage(payload) {
  const { data } = await api.post("/city/contact/", payload);
  return data;
}

export async function getCitizenContactMessages(params = {}) {
  const { data } = await api.get("/citizen/contact-messages/", { params });
  return unwrapList(data).map(normalizeContact);
}

export async function getCitizenContactMessage(reference) {
  const { data } = await api.get(`/citizen/contact-messages/${encodeURIComponent(reference)}/`);
  return normalizeContact(data);
}

export async function getAgentContactMessages(params = {}) {
  const { data } = await api.get("/agent/contact-messages/", { params });
  return unwrapList(data).map(normalizeContact);
}

export async function getAgentContactMessage(reference) {
  const { data } = await api.get(`/agent/contact-messages/${encodeURIComponent(reference)}/`);
  return normalizeContact(data);
}

export async function updateAgentContactMessage(reference, payload) {
  const { data } = await api.patch(`/agent/contact-messages/${encodeURIComponent(reference)}/`, payload);
  return normalizeContact(data);
}

export async function getAdminContactMessages(params = {}) {
  const { data } = await api.get("/admin/contact-messages/", { params });
  return unwrapList(data).map(normalizeContact);
}

export async function getAdminContactMessage(reference) {
  const { data } = await api.get(`/admin/contact-messages/${encodeURIComponent(reference)}/`);
  return normalizeContact(data);
}

export async function updateAdminContactMessage(reference, payload) {
  const { data } = await api.patch(`/admin/contact-messages/${encodeURIComponent(reference)}/`, payload);
  return normalizeContact(data);
}
