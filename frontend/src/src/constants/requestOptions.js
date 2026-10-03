export const REQUEST_TYPES = [
  { value: "question", label: "Question", icon: "?", helper: "Obtenir une information" },
  { value: "signalement", label: "Signaler", icon: "!", helper: "Déclarer un problème" },
  { value: "demarche", label: "Démarche", icon: "▤", helper: "Aide administrative" },
  { value: "suggestion", label: "Suggestion", icon: "✦", helper: "Proposer une idée" },
  { value: "assistance", label: "Assistance", icon: "+", helper: "Besoin d'aide" },
];

export const REQUEST_CATEGORIES = [
  "État civil",
  "Voirie",
  "Eau / assainissement",
  "Éclairage public",
  "Transport",
  "Déchets",
  "Services numériques",
  "Sécurité",
  "Autre",
];

export const CATEGORY_SERVICE = {
  "État civil": "Administration",
  Voirie: "Infrastructure",
  "Eau / assainissement": "Infrastructure",
  "Éclairage public": "Énergie",
  Transport: "Transport",
  Déchets: "Infrastructure",
  "Services numériques": "Administration",
  "Sécurité": "Sécurité",
  Autre: "Administration",
};

export function getRequestSuggestion(category, subject = "", message = "") {
  const text = `${subject} ${message}`.toLowerCase();
  if (category === "État civil" || /acte|naissance|attestation/.test(text)) {
    return {
      title: "Une démarche existe peut-être déjà",
      action: "Consulter les démarches administratives",
      description: "Avant d'envoyer, vérifiez si votre document peut être demandé directement en ligne.",
      path: "/services/administration",
    };
  }
  if (category === "Transport" && /carte|abonnement|ligne|horaire/.test(text)) {
    return {
      title: "Le service Transport peut répondre directement",
      action: "Voir le service Transport",
      description: "Cartes, lignes et horaires sont déjà regroupés dans le service municipal Transport.",
      path: "/services/transport",
    };
  }
  if (category === "Services numériques" && /connexion|mot de passe|compte/.test(text)) {
    return {
      title: "Un accès rapide est disponible",
      action: "Ouvrir l'espace de connexion",
      description: "Si votre demande concerne l'accès au compte, essayez d'abord l'espace de connexion.",
      path: "/login",
    };
  }
  return null;
}


export const REPORT_TYPES = [
  {
    value: "street_light",
    label: "Éclairage / lampadaire",
    icon: "✦",
    category: "Éclairage public",
    service: "Énergie",
    helper: "Lampadaire éteint, clignotant ou endommagé",
  },
  {
    value: "road",
    label: "Voirie / chaussée",
    icon: "⌁",
    category: "Voirie",
    service: "Infrastructure",
    helper: "Trou, obstacle, trottoir ou équipement de voirie",
  },
  {
    value: "water",
    label: "Eau / fuite",
    icon: "◒",
    category: "Eau / assainissement",
    service: "Infrastructure",
    helper: "Fuite, écoulement, canalisation ou assainissement",
  },
  {
    value: "waste",
    label: "Déchets / propreté",
    icon: "▧",
    category: "Déchets",
    service: "Infrastructure",
    helper: "Dépôt, collecte ou problème de propreté",
  },
  {
    value: "transport",
    label: "Transport",
    icon: "↔",
    category: "Transport",
    service: "Transport",
    helper: "Arrêt, ligne, équipement ou incident de mobilité",
  },
  {
    value: "safety",
    label: "Sécurité / danger",
    icon: "!",
    category: "Sécurité",
    service: "Sécurité",
    helper: "Situation dangereuse nécessitant une intervention municipale",
  },
  {
    value: "public_space",
    label: "Espace public / bâtiment",
    icon: "◇",
    category: "Voirie",
    service: "Infrastructure",
    helper: "Mobilier, bâtiment public ou équipement dégradé",
  },
  {
    value: "other",
    label: "Autre problème",
    icon: "+",
    category: "Autre",
    service: "Administration",
    helper: "Tout autre problème à signaler à la ville",
  },
];

export const REPORT_TYPE_BY_VALUE = Object.fromEntries(
  REPORT_TYPES.map((item) => [item.value, item]),
);
