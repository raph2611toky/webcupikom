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
