export const currentCitizen = {
  id: "CIT-0021",
  firstName: "Jennysca",
  lastName: "Razanaparany",
  email: "jennysca@novaterra.city",
  phone: "+TN 261 34 00 000 00",
  district: "Astra",
  sector: "A-07",
  street: "Avenue des Pionniers",
  building: "Kepler 12",
  apartment: "B-04",
  preferredChannel: "Notification + e-mail",
  language: "Français",
  accountStatus: "Actif",
  joinedAt: "18 septembre 2026",
  lastLogin: "03 octobre 2026 · 09:18",
  profileCompletion: 75,
};

export const citizenRequests = [
  { id: "NT-2026-0014", title: "Signalement éclairage public", service: "Infrastructure", status: "En traitement", created: "03 octobre · 08:30", updated: "03 octobre · 09:15", district: "Astra", description: "Lampadaire défectueux près de l’accès principal du bloc Kepler 12." },
  { id: "NT-2026-0021", title: "Carte de transport", service: "Transport", status: "Action requise", created: "02 octobre · 15:40", updated: "03 octobre · 08:42", district: "Astra", description: "Demande de carte de transport pour la nouvelle ligne N7." },
  { id: "NT-2026-0028", title: "Attestation de résidence", service: "Administration", status: "Envoyée", created: "03 octobre · 09:02", updated: "03 octobre · 09:02", district: "Astra", description: "Demande d’attestation pour dossier administratif." },
  { id: "NT-2026-0009", title: "Intervention logement", service: "Habitat", status: "Terminée", created: "29 septembre · 13:20", updated: "01 octobre · 10:12", district: "Astra", description: "Contrôle du système de ventilation du logement." },
  { id: "NT-2026-0005", title: "Anomalie énergétique", service: "Énergie", status: "Terminée", created: "27 septembre · 18:10", updated: "28 septembre · 11:05", district: "Helios", description: "Variation ponctuelle sur une borne secondaire." },
];

export const notifications = [
  { id: 1, unread: true, title: "Votre demande NT-2026-0014 est en traitement.", time: "Il y a 10 min", type: "request" },
  { id: 2, unread: true, title: "Nouvelle information municipale : maintenance Helios.", time: "Il y a 2 h", type: "news" },
  { id: 3, unread: false, title: "Votre demande NT-2026-0009 est terminée.", time: "Hier", type: "request" },
  { id: 4, unread: false, title: "La ligne N7 est maintenant disponible.", time: "Hier", type: "transport" },
];

export const agentRequests = [
  { ref: "NT-001", citizen: "Lina Nova", citizenId: "CIT-0012", service: "Transport", status: "À traiter", priority: "Normale", created: "09:02" },
  { ref: "NT-002", citizen: "Marc Astra", citizenId: "CIT-0015", service: "Habitat", status: "En traitement", priority: "Haute", created: "08:47" },
  { ref: "NT-003", citizen: "Ava Terra", citizenId: "CIT-0019", service: "Énergie", status: "Terminée", priority: "Normale", created: "08:20" },
  { ref: "NT-004", citizen: "Noah Kepler", citizenId: "CIT-0024", service: "Administration", status: "Action requise", priority: "Normale", created: "07:58" },
  { ref: "NT-005", citizen: "Mila Orion", citizenId: "CIT-0030", service: "Sécurité", status: "À traiter", priority: "Haute", created: "07:42" },
];

export const citizens = [
  { id: "CIT-0012", name: "Lina Nova", district: "Astra", requests: 4, status: "Actif", email: "lina@novaterra.city", phone: "+TN 100 001" },
  { id: "CIT-0015", name: "Marc Astra", district: "Kepler", requests: 7, status: "Actif", email: "marc@novaterra.city", phone: "+TN 100 002" },
  { id: "CIT-0019", name: "Ava Terra", district: "Helios", requests: 3, status: "Actif", email: "ava@novaterra.city", phone: "+TN 100 003" },
  { id: "CIT-0024", name: "Noah Kepler", district: "Orion", requests: 2, status: "Actif", email: "noah@novaterra.city", phone: "+TN 100 004" },
  { id: "CIT-0030", name: "Mila Orion", district: "Astra", requests: 6, status: "Actif", email: "mila@novaterra.city", phone: "+TN 100 005" },
];

export const webcupRequests = [
  { code: "D01", group: "Haut Conseil", title: "Inscription citoyen", difficulty: "Facile", xp: 250 },
  { code: "D03", group: "Services municipaux", title: "Connexion", difficulty: "Facile", xp: 250 },
  { code: "D05", group: "Services municipaux", title: "Annuaire des services", difficulty: "Moyenne", xp: 500 },
  { code: "D06", group: "Communication", title: "Actualités", difficulty: "Moyenne", xp: 500 },
  { code: "D07", group: "Ville", title: "Page d’accueil", difficulty: "Moyenne", xp: 500 },
];

export const adminUsers = [
  { id: "USR-101", name: "Jennysca Razanaparany", email: "jennysca@novaterra.city", role: "Citoyen", status: "Actif" },
  { id: "USR-076", name: "Lina Nova", email: "lina@novaterra.city", role: "Citoyen", status: "Actif" },
  { id: "USR-014", name: "Marc Vega", email: "marc.vega@novaterra.city", role: "Agent", status: "Actif" },
  { id: "USR-002", name: "Admin Terra", email: "admin@novaterra.city", role: "Admin", status: "Actif" },
];
