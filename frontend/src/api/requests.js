import { citizenRequests, agentRequests, currentCitizen } from "../data/mockData.js";
import { CATEGORY_SERVICE } from "../constants/requestOptions.js";

const STORAGE_KEY = "terra_nova_demo_requests_v1";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function loadStored() {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStored(rows) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function nextReference(rows) {
  const all = [
    ...citizenRequests.map((row) => row.id),
    ...rows.map((row) => row.reference),
  ];
  const max = all.reduce((value, ref) => {
    const match = String(ref || "").match(/(\d+)$/);
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 0);
  return `NT-2026-${String(max + 1).padStart(4, "0")}`;
}

function toDisplayDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Aujourd’hui";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", " ·");
}

function normalizeStoredForCitizen(row) {
  return {
    id: row.reference,
    title: row.subject,
    service: row.service,
    category: row.category,
    requestType: row.type,
    status: row.status,
    created: toDisplayDate(row.createdAt),
    updated: toDisplayDate(row.updatedAt),
    district: row.location?.label || "Non précisé",
    description: row.message,
    location: row.location || null,
    attachments: row.attachments || [],
    history: row.history || [],
    source: row.source,
  };
}

function normalizeStoredForAgent(row) {
  return {
    ref: row.reference,
    citizen: row.citizen?.name || "Visiteur",
    citizenId: row.citizen?.id || "PUBLIC",
    service: row.service,
    category: row.category,
    status: row.status === "En attente" ? "À traiter" : row.status,
    priority: row.priority || "Normale",
    created: toDisplayDate(row.createdAt),
    title: row.subject,
    description: row.message,
    requestType: row.type,
    location: row.location || null,
    attachments: row.attachments || [],
    history: row.history || [],
    contact: row.contact || null,
    source: row.source,
  };
}

export async function createCitizenRequest(payload) {
  const rows = loadStored();
  const now = new Date().toISOString();
  const reference = nextReference(rows);
  const type = payload.type || "question";
  const priority = type === "assistance" ? "Haute" : "Normale";
  const request = {
    reference,
    source: payload.source || "citizen",
    type,
    category: payload.category || "Autre",
    service: payload.service || CATEGORY_SERVICE[payload.category] || "Administration",
    subject: payload.subject || "Demande citoyenne",
    message: payload.message || "",
    status: "En attente",
    priority,
    citizen: payload.citizen || {
      id: currentCitizen.id,
      name: `${currentCitizen.firstName} ${currentCitizen.lastName}`,
    },
    contact: payload.contact || null,
    location: payload.location || null,
    attachments: (payload.attachments || []).map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size || 0,
    })),
    createdAt: now,
    updatedAt: now,
    history: [
      { key: "submitted", label: "Demande envoyée", at: now, state: "done" },
      { key: "received", label: "Demande reçue par la ville", at: now, state: "done" },
      { key: "assignment", label: "Prise en charge par un agent", at: null, state: "next" },
      { key: "processing", label: "Traitement en cours", at: null, state: "next" },
      { key: "resolved", label: "Résolue", at: null, state: "next" },
    ],
  };
  saveStored([request, ...rows]);
  return request;
}

export async function getCitizenRequests() {
  return [...loadStored().map(normalizeStoredForCitizen), ...citizenRequests];
}

export async function getAgentRequests() {
  return [...loadStored().map(normalizeStoredForAgent), ...agentRequests];
}

export async function getCitizenRequestById(id) {
  const stored = loadStored().find((row) => row.reference === id);
  if (stored) return normalizeStoredForCitizen(stored);
  return citizenRequests.find((row) => row.id === id) || null;
}

export async function getAgentRequestById(id) {
  const stored = loadStored().find((row) => row.reference === id);
  if (stored) return normalizeStoredForAgent(stored);
  return agentRequests.find((row) => row.ref === id) || null;
}

export async function updateRequestStatus(reference, status, note = "") {
  const rows = loadStored();
  const index = rows.findIndex((row) => row.reference === reference);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const current = rows[index];
  const history = [...(current.history || [])];
  const stepByStatus = {
    "En traitement": "processing",
    "Action requise": "assignment",
    "Terminée": "resolved",
    "À traiter": "assignment",
  };
  const step = stepByStatus[status];
  const updatedHistory = history.map((item) => {
    if (item.key === step) return { ...item, at: now, state: "done", note: note || item.note };
    return item;
  });
  rows[index] = { ...current, status, updatedAt: now, history: updatedHistory };
  saveStored(rows);
  return rows[index];
}

export async function addRequestInformation(reference, message) {
  const rows = loadStored();
  const index = rows.findIndex((row) => row.reference === reference);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const notes = [...(rows[index].notes || []), { message, at: now, author: "citizen" }];
  rows[index] = { ...rows[index], notes, updatedAt: now };
  saveStored(rows);
  return rows[index];
}
