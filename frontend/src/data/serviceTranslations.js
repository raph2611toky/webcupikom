
export const SERVICE_TRANSLATIONS = {
  transport: {
    en: {
      name: "Transport",
      category: "Transport",
      shortDescription: "Public routes, shuttles and mobility between Nova Terra sectors.",
      description: "The mobility department coordinates shuttles, inter-sector lines and travel-related requests throughout the city.",
      actions: ["Request a transport card", "Report a problem", "Check schedules"],
      requiredDocuments: ["Identity document", "Proof of residence"],
    },
  },
  habitat: {
    en: {
      name: "Housing",
      category: "Housing",
      shortDescription: "Housing, residences, buildings and maintenance of inhabited areas.",
      description: "The Housing department supports residents with allocation, maintenance and building-related requests.",
      actions: ["Report an incident", "Update my housing information", "Request an intervention"],
      requiredDocuments: ["Citizen ID", "Housing reference"],
    },
  },
  energie: {
    en: {
      name: "Energy",
      category: "Energy",
      shortDescription: "Electricity distribution, consumption and anomaly reporting.",
      description: "The Energy department supervises sector supply, consumption alerts and network incidents.",
      actions: ["Report an outage", "Check my sector", "Request an inspection"],
      requiredDocuments: ["Citizen ID", "Address of the affected location"],
    },
  },
  administration: {
    en: {
      name: "Administration",
      category: "Administration",
      shortDescription: "Official documents, identity, certificates and civic procedures.",
      description: "The central administrative desk manages document requests and citizen identity updates.",
      actions: ["Request a certificate", "Update my information", "Book an appointment"],
      requiredDocuments: ["Citizen ID", "Supporting document depending on the procedure"],
    },
  },
  sante: {
    en: {
      name: "Health",
      category: "Health",
      shortDescription: "Medical centers, prevention, appointments and health information.",
      description: "The Health network brings together medical centers, prevention campaigns and useful information for residents.",
      actions: ["Find a center", "Request an appointment", "View health information"],
      requiredDocuments: ["Citizen ID"],
    },
  },
  securite: {
    en: {
      name: "Safety",
      category: "Safety",
      shortDescription: "Reports, prevention and urban safety coordination.",
      description: "The Safety department receives reports, coordinates interventions and publishes important guidance.",
      actions: ["Submit a report", "View safety guidance", "Contact an agent"],
      requiredDocuments: ["No document required for an urgent report"],
    },
  },
};
