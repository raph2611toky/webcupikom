function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "—") {
  if (value === undefined || value === null || value === "") return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map((item) => safeText(item, "")).filter(Boolean).join(", ") || fallback;
  if (typeof value === "object") {
    if (value.label || value.name || value.display_name) return String(value.label || value.name || value.display_name);
    return JSON.stringify(value);
  }
  return fallback;
}

function dateText(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function rowsTable(headers, rows) {
  if (!rows.length) return '<p class="empty">Aucune donnée.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(typeof h.value === "function" ? h.value(row) : row[h.value])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function profileGrid(profile = {}) {
  const rows = [
    ["Nom", profile.display_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim()],
    ["E-mail", profile.email],
    ["Téléphone", profile.phone_number],
    ["Profession", profile.profession],
    ["Adresse", profile.address],
    ["Quartier", profile.district],
    ["Secteur", profile.sector],
    ["Rue", profile.street],
    ["Bâtiment", profile.building],
    ["Appartement", profile.apartment],
    ["Langue", profile.locale],
    ["E-mail vérifié", profile.email_verified === true ? "Oui" : profile.email_verified === false ? "Non" : "—"],
  ];
  return `<div class="facts">${rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(safeText(value))}</strong></div>`).join("")}</div>`;
}

function requestRows(items = []) {
  return rowsTable([
    { label: "Référence", value: (x) => x.reference || x.ref },
    { label: "Type", value: (x) => x.requestType === "signalement" ? "Signalement" : "Démarche" },
    { label: "Titre", value: (x) => x.title },
    { label: "Service", value: (x) => x.service },
    { label: "Statut", value: (x) => x.status },
    { label: "Priorité", value: (x) => x.priority },
    { label: "Créée", value: (x) => dateText(x.createdAt) },
    { label: "Mise à jour", value: (x) => dateText(x.updatedAt) },
  ], items);
}

function appointmentRows(items = []) {
  return rowsTable([
    { label: "Référence", value: (x) => x.reference },
    { label: "Service", value: (x) => x.serviceName },
    { label: "Agent", value: (x) => x.agentName },
    { label: "Début", value: (x) => dateText(x.startsAt) },
    { label: "Fin", value: (x) => dateText(x.endsAt) },
    { label: "Statut", value: (x) => x.statusLabel || x.status },
    { label: "Motif", value: (x) => x.reason },
  ], items);
}

function notificationRows(items = []) {
  return rowsTable([
    { label: "Date", value: (x) => dateText(x.created_at) },
    { label: "Catégorie", value: (x) => x.category },
    { label: "Titre", value: (x) => x.title },
    { label: "Message", value: (x) => x.message },
    { label: "Lue", value: (x) => x.is_read ? "Oui" : "Non" },
    { label: "Demande", value: (x) => x.request_reference || "" },
  ], items);
}

function messageRows(items = []) {
  return rowsTable([
    { label: "Référence", value: (x) => x.reference },
    { label: "Date", value: (x) => dateText(x.created_at) },
    { label: "Objet", value: (x) => x.subject },
    { label: "Service", value: (x) => x.service_name },
    { label: "Statut", value: (x) => x.statusLabel || x.status },
  ], items);
}

function documentShell(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
    :root{font-family:Inter,Arial,sans-serif;color:#15151a;background:#fff}body{margin:0;padding:32px;line-height:1.5}main{max-width:1120px;margin:0 auto}h1{font-size:28px;margin:0 0 8px}h2{margin:30px 0 12px;font-size:19px;border-bottom:2px solid #111;padding-bottom:6px}.meta{color:#666;margin-bottom:28px}.summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:20px 0}.summary div,.facts div{border:1px solid #ddd;border-radius:10px;padding:12px}.summary strong{display:block;font-size:23px}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.facts span{display:block;color:#666;font-size:12px}.facts strong{display:block;margin-top:3px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#f5f5f7}.empty{color:#777}.warning{padding:10px;border:1px solid #d99;border-radius:8px;background:#fff8f8}.print-note{font-size:12px;color:#666}@media print{body{padding:0}.print-note{display:none}.table-wrap{overflow:visible}a{color:inherit;text-decoration:none}}@media(max-width:700px){.summary,.facts{grid-template-columns:1fr 1fr}body{padding:16px}}
  </style></head><body><main>${body}</main></body></html>`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadJson(filename, data) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
}

export function downloadHtml(filename, html) {
  downloadBlob(filename, new Blob([html], { type: "text/html;charset=utf-8" }));
}

export function openPrintWindow(html) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Le navigateur a bloqué la fenêtre d’impression. Autorisez les fenêtres contextuelles pour ce site.");
  try { win.opener = null; } catch {}
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
}

export function buildPersonalDataHtml(bundle) {
  const allRequests = [...(bundle.requests || []), ...(bundle.reports || [])];
  const summary = bundle.summary || {};
  const body = `
    <h1>Mes données — Nova Terra</h1>
    <div class="meta">Export préparé le ${escapeHtml(dateText(bundle.generated_at))}. Document personnel à conserver dans un endroit sûr.</div>
    <div class="summary">
      <div><span>Démarches</span><strong>${Number(summary.requests || 0)}</strong></div>
      <div><span>Signalements</span><strong>${Number(summary.reports || 0)}</strong></div>
      <div><span>Rendez-vous</span><strong>${Number(summary.appointments || 0)}</strong></div>
      <div><span>Notifications</span><strong>${Number(summary.notifications || 0)}</strong></div>
      <div><span>Messages</span><strong>${Number(summary.contact_messages || 0)}</strong></div>
    </div>
    ${bundle.warnings?.length ? `<div class="warning"><strong>Export partiel</strong><br>${bundle.warnings.map(escapeHtml).join("<br>")}</div>` : ""}
    <h2>Mes informations</h2>${profileGrid(bundle.profile)}
    <h2>Mes demandes et signalements</h2>${requestRows(allRequests)}
    <h2>Mes rendez-vous</h2>${appointmentRows(bundle.appointments || [])}
    <h2>Mes notifications</h2>${notificationRows(bundle.notifications || [])}
    <h2>Mes messages à la ville</h2>${messageRows(bundle.contact_messages || [])}
    <h2>Mes préférences</h2><pre>${escapeHtml(JSON.stringify(bundle.preferences || {}, null, 2))}</pre>
    <p class="print-note">Vous pouvez utiliser « Imprimer » puis « Enregistrer au format PDF » pour conserver une copie PDF.</p>`;
  return documentShell("Mes données — Nova Terra", body);
}

export function buildRequestsHtml(items = []) {
  return documentShell("Récapitulatif de mes demandes — Nova Terra", `
    <h1>Récapitulatif de mes demandes</h1>
    <div class="meta">Généré le ${escapeHtml(dateText(new Date().toISOString()))} · ${items.length} dossier${items.length > 1 ? "s" : ""}</div>
    ${requestRows(items)}
    <p class="print-note">Vous pouvez utiliser « Imprimer » puis « Enregistrer au format PDF ».</p>`);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""').replaceAll("\r", " ").replaceAll("\n", " ")}"`;
}

export function downloadRequestsCsv(items = [], filename = "nova-terra-mes-demandes.csv") {
  const headers = ["reference","type","titre","description","service","categorie","statut","priorite","lieu","cree_le","mis_a_jour","resolution"];
  const lines = [headers.map(csvCell).join(",")];
  items.forEach((item) => lines.push([
    item.reference || item.ref,
    item.requestType === "signalement" ? "signalement" : "procedure",
    item.title,
    item.description,
    item.service,
    item.category || item.reportType,
    item.status,
    item.priority,
    item.location?.label || item.district || "",
    item.createdAt || "",
    item.updatedAt || "",
    item.resolutionSummary || "",
  ].map(csvCell).join(",")));
  downloadBlob(filename, new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
}

export function buildSingleRequestHtml(request) {
  const timeline = request.timeline?.length ? request.timeline : request.history || [];
  const attachmentRows = request.attachments || [];
  const body = `
    <h1>${escapeHtml(request.title || "Demande")}</h1>
    <div class="meta">Référence ${escapeHtml(request.reference || request.ref || "—")} · ${escapeHtml(request.status || "—")}</div>
    <div class="facts">
      <div><span>Type</span><strong>${escapeHtml(request.requestType === "signalement" ? "Signalement" : "Démarche")}</strong></div>
      <div><span>Service</span><strong>${escapeHtml(safeText(request.service))}</strong></div>
      <div><span>Catégorie</span><strong>${escapeHtml(safeText(request.category || request.reportType))}</strong></div>
      <div><span>Priorité</span><strong>${escapeHtml(safeText(request.priority))}</strong></div>
      <div><span>Création</span><strong>${escapeHtml(dateText(request.createdAt))}</strong></div>
      <div><span>Dernière mise à jour</span><strong>${escapeHtml(dateText(request.updatedAt))}</strong></div>
      <div><span>Lieu</span><strong>${escapeHtml(safeText(request.location?.label || request.district))}</strong></div>
      <div><span>Résultat / suivi</span><strong>${escapeHtml(safeText(request.resolutionSummary))}</strong></div>
    </div>
    <h2>Description</h2><p>${escapeHtml(request.description || "—")}</p>
    <h2>Historique</h2>${rowsTable([
      {label:"Date",value:(x)=>dateText(x.createdAt || x.at)},
      {label:"Étape",value:(x)=>x.title || x.label},
      {label:"Message",value:(x)=>x.message},
      {label:"Acteur",value:(x)=>[x.actorName,x.actorRole].filter(Boolean).join(" · ")},
    ], timeline)}
    <h2>Pièces jointes</h2>${rowsTable([
      {label:"Nom",value:(x)=>x.name},
      {label:"Légende",value:(x)=>x.caption},
      {label:"Auteur",value:(x)=>x.uploaderName},
      {label:"Date",value:(x)=>dateText(x.createdAt)},
    ], attachmentRows)}
    <p class="print-note">Ce document est une copie lisible du dossier au moment de l’export.</p>`;
  return documentShell(`${request.reference || request.ref || "Demande"} — Nova Terra`, body);
}
