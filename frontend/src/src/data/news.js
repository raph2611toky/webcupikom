import heroCitizen from "../assets/hero/hero-1.webp";
import heroTransport from "../assets/hero/hero-travel.webp";
import heroAdmin from "../assets/hero/hero-list.webp";
import heroHealth from "../assets/hero/hero-phone.webp";

export const news = [
  {
    slug: "maintenance-energetique-helios",
    category: "Important",
    kind: "Annonce municipale",
    date: "03 octobre 2026",
    image: heroCitizen,
    title: "Maintenance programmée du secteur énergétique Helios",
    excerpt: "Une opération préventive est prévue sur le réseau secondaire. Quelques micro-coupures peuvent survenir.",
    body: "Les équipes techniques de Nova Terra procèdent à une maintenance préventive du réseau Helios afin de renforcer la stabilité de l’alimentation. Les secteurs concernés seront informés par notification. Les services essentiels restent prioritaires pendant l’intervention.",
  },
  {
    slug: "nouvelle-ligne-navette-astra",
    category: "Transport",
    kind: "Changement de service",
    date: "02 octobre 2026",
    image: heroTransport,
    title: "Une nouvelle ligne de navette relie Astra à Kepler",
    excerpt: "La ligne N7 entre en service avec une fréquence renforcée aux heures de pointe.",
    body: "La ligne N7 facilite les déplacements entre le centre administratif Astra et le pôle résidentiel Kepler. Les horaires sont disponibles dans le service Transport.",
  },
  {
    slug: "guichet-civique-numerique",
    category: "Administration",
    kind: "Information pratique",
    date: "01 octobre 2026",
    image: heroAdmin,
    title: "Le guichet civique devient accessible en ligne",
    excerpt: "Plusieurs attestations peuvent désormais être demandées directement depuis l’espace citoyen.",
    body: "Cette évolution permet aux habitants de déposer une demande, joindre les documents nécessaires et suivre son avancement sans se déplacer.",
  },
  {
    slug: "campagne-prevention-aurora",
    category: "Santé",
    kind: "Information pratique",
    date: "30 septembre 2026",
    image: heroHealth,
    title: "Campagne de prévention au centre Aurora",
    excerpt: "Des créneaux d’information et de dépistage sont ouverts toute la semaine.",
    body: "Le centre Aurora propose une semaine d’information et de prévention. Les habitants peuvent consulter les créneaux depuis le service Santé.",
  },
];
