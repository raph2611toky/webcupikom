import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "../../utils/i18n.js";
import { useDataMode } from "../../utils/useDataMode.js";
import "./Features.css";

import avatarOne from "../../assets/hero/hero-1.webp";
import avatarTwo from "../../assets/hero/hero-2.webp";
import avatarThree from "../../assets/hero/hero-3.webp";

const EASE = [0.16, 1, 0.3, 1];

const FEATURES_TEXT = {
  fr: {
    kicker:"Services", titleStart:"Une ville", titleAccent:"qui évolue",
    lead:"Nova Terra centralise les services, l’information et les besoins de ses habitants.",
    leadSoft:"Un espace numérique qui accompagne la ville à mesure qu’elle grandit.",
    stageKicker:"NOVA TERRA, AU PLUS PRÈS DU QUOTIDIEN", stageLines:["Des services","pour chaque","besoin","de la ville"],
    cards:[
      {title:"Services de la ville",description:<>Accédez aux services,<br/>informations utiles et<br/>contenus de la ville.</>,preview:["Informations locales","Services de la ville"]},
      {title:"Exprimer un besoin",description:<>Faites remonter un besoin,<br/>communiquez ou signalez<br/>un problème simplement.</>,preview:["Besoin citoyen","Envoyer une demande"]},
      {title:"Rester informé",description:<>Suivez les informations<br/>et les nouveaux services<br/>de Nova Terra.</>,preview:["Haut Conseil · Information"]},
    ], stat:"ville en évolution", flow:"Flux vivant de besoins", note:<>Plus simple<br/>pour vivre la ville</>, aria:"Exemples de services de Nova Terra",
  },
  en: {
    kicker:"Services", titleStart:"A city", titleAccent:"that evolves",
    lead:"Nova Terra brings city services, information and residents’ needs together.", leadSoft:"A digital space that grows with the city.",
    stageKicker:"NOVA TERRA, CLOSER TO EVERYDAY LIFE", stageLines:["Services","for every","city","need"],
    cards:[
      {title:"City services",description:<>Access services,<br/>useful information and<br/>city content.</>,preview:["Local information","City services"]},
      {title:"Share a need",description:<>Ask a question,<br/>communicate or report<br/>an issue simply.</>,preview:["Citizen request","Send a request"]},
      {title:"Stay informed",description:<>Follow city information<br/>and new services<br/>in Nova Terra.</>,preview:["High Council · Information"]},
    ], stat:"evolving city", flow:"Live flow of needs", note:<>A simpler way<br/>to live the city</>, aria:"Examples of Nova Terra services",
  },
  mg: {
    kicker:"Sampan-draharaha", titleStart:"Tanàna", titleAccent:"mivoatra",
    lead:"Nova Terra dia manangona amin’ny toerana iray ny sampan-draharaha, ny vaovao ary ny filàn’ny mponina.", leadSoft:"Habaka nomerika iray izay miara-mivoatra amin’ny tanàna.",
    stageKicker:"NOVA TERRA, AKAIKY NY FIAINANA ANDAVANANDRO", stageLines:["Tolotra","ho an'ny","filàna","rehetra"],
    cards:[
      {title:"Sampan-draharahan'ny tanàna",description:<>Midira amin'ny tolotra,<br/>vaovao ilaina ary<br/>votoatin'ny tanàna.</>,preview:["Vaovao eo an-toerana","Sampan-draharaha"]},
      {title:"Ampitao ny filàna",description:<>Mametraha fanontaniana,<br/>mifandraisa na mitatitra<br/>olana mora foana.</>,preview:["Filàn'ny mponina","Handefa fangatahana"]},
      {title:"Mahazoa vaovao",description:<>Araho ny vaovao<br/>sy ny tolotra vaovao<br/>ao Nova Terra.</>,preview:["Filankevitra Ambony · Vaovao"]},
    ], stat:"tanàna mivoatra", flow:"Filàna havaozina hatrany", note:<>Mora kokoa<br/>ny miaina an-tanàna</>, aria:"Ohatra amin'ny sampan-draharaha Nova Terra",
  },
};

/* Inclinaison des cartes, calée sur la maquette */
const CARD_ROTATE = { calendar: -14, travel: 0, mail: 14 };

function CalendarIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 10h24a5 5 0 0 1 5 5v21a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5Z" fill="currentColor" />
      <path d="M7 19h34v4H7z" fill="#fff" opacity=".96" />
      <path d="M16 7v8M32 7v8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="13" y="26" width="6" height="5" rx="1.4" fill="#fff" />
      <rect x="21" y="26" width="6" height="5" rx="1.4" fill="#fff" />
      <rect x="29" y="26" width="6" height="5" rx="1.4" fill="#fff" />
      <rect x="13" y="33" width="6" height="4" rx="1.3" fill="#fff" />
      <rect x="21" y="33" width="6" height="4" rx="1.3" fill="#fff" />
    </svg>
  );
}

function CouncilIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 20 24 9l16 11" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 21h26v4H11zM14 25h4v13h-4zm8 0h4v13h-4zm8 0h4v13h-4zM9 39h30v4H9z" fill="currentColor" />
    </svg>
  );
}

function RequestIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 6c9.4 0 17 6.6 17 14.8 0 8.1-7.6 14.8-17 14.8-1.9 0-3.8-.3-5.5-.8L10 41l2.4-9C9 29.4 7 25.5 7 20.8 7 12.6 14.6 6 24 6Z" fill="currentColor" />
      <circle cx="17" cy="21" r="2.1" fill="#fff" />
      <circle cx="24" cy="21" r="2.1" fill="#fff" />
      <circle cx="31" cy="21" r="2.1" fill="#fff" />
    </svg>
  );
}

function ArrowCircle() {
  return (
    <span className="feature-arrow-circle" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          d="M7.25 12h8.35M12.85 8.4 16.45 12l-3.6 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function AutomationSeal() {
  return (
    <div className="automation-seal" aria-hidden="true">
      <svg viewBox="0 0 170 170">
        <defs>
          <path id="seal-top" d="M85,85 m-56,0 a56,56 0 1,1 112,0 a56,56 0 1,1 -112,0" />
          <path id="seal-bottom" d="M85,85 m-66,0 a66,66 0 1,0 132,0 a66,66 0 1,0 -132,0" />
        </defs>
        <text>
          <textPath href="#seal-top" startOffset="25%" textAnchor="middle">NOVA TERRA</textPath>
        </text>
        <text>
          <textPath href="#seal-bottom" startOffset="25%" textAnchor="middle">VILLE · CITOYENS</textPath>
        </text>
      </svg>
      <span className="automation-seal__star">✦</span>
      <span className="automation-seal__dot automation-seal__dot--left" />
      <span className="automation-seal__dot automation-seal__dot--right" />
    </div>
  );
}

function FeatureCard({ type, icon, title, description, children, delay = 0 }) {
  const reduceMotion = useReducedMotion();
  const rotate = CARD_ROTATE[type] ?? 0;

  return (
    <motion.article
      className={`feature-card feature-card--${type}`}
      initial={reduceMotion ? false : { opacity: 0, rotate }}
      whileInView={{ opacity: 1, rotate }}
      viewport={{ once: true, amount: 0.26 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      whileHover={undefined}
    >
      <div className="feature-card__icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </motion.article>
  );
}

function HeaderSparkles() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="features-sparkles"
      aria-hidden="true"
      animate={reduceMotion ? undefined : { rotate: [0, 9, -4, 0], y: [0, -5, 1, 0] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="features-sparkles__large">✦</span>
      <span className="features-sparkles__small">✦</span>
    </motion.div>
  );
}

export default function Features() {
  const systemReduceMotion = useReducedMotion();
  const dataProfile = useDataMode();
  const reduceMotion = systemReduceMotion || dataProfile.reduced;
  const [locale] = useLocale();
  const copy = FEATURES_TEXT[locale] || FEATURES_TEXT.fr;

  return (
    <section className="features-section" id="fonctionnalites" aria-labelledby="features-title">
      <div className="features-section__texture" aria-hidden="true" />

      <motion.div
        className="features-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.55 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <span className="features-kicker">{copy.kicker}</span>
        <h2 id="features-title">{copy.titleStart} <span>{copy.titleAccent}</span></h2>
        <p className="features-lead">{copy.lead}</p>
        <p className="features-lead features-lead--soft">{copy.leadSoft}</p>
      </motion.div>

      {!dataProfile.reduced ? <HeaderSparkles /> : null}

      <motion.div
        className="features-stage"
        initial={reduceMotion ? false : { opacity: 0, y: 42, scale: 0.985 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.85, delay: 0.12, ease: EASE }}
      >
        <div className="features-stage__intro">
          <span>{copy.stageKicker}</span>
          <h3 className="features-stage__title">
            {copy.stageLines.map((line)=><span key={line}>{line}</span>)}
          </h3>
          <i aria-hidden="true" />
        </div>

        <svg className="features-stage__wave" viewBox="0 0 430 140" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="features-wave-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4b14f5" />
              <stop offset="55%" stopColor="#8a18f0" />
              <stop offset="100%" stopColor="#ff1fd0" />
            </linearGradient>
          </defs>
          <motion.path
            d="M-12 86 C 70 50, 150 12, 230 20 C 285 26, 300 84, 335 108 C 355 120, 375 118, 400 112"
            stroke="url(#features-wave-gradient)"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.75, ease: "easeInOut" }}
          />
        </svg>

        <div className="features-cards" aria-label={copy.aria}>
          <FeatureCard
            type="calendar"
            icon={<CalendarIcon />}
            title={copy.cards[0].title}
            description={copy.cards[0].description}
            delay={0.18}
          >
            <div className="calendar-preview">
              <div><strong>01</strong><span className="calendar-preview__dot" />{copy.cards[0].preview[0]}</div>
              <div><strong>02</strong><span className="calendar-preview__dot" />{copy.cards[0].preview[1]}</div>
            </div>
          </FeatureCard>

          <FeatureCard
            type="travel"
            icon={<RequestIcon />}
            title={copy.cards[1].title}
            description={copy.cards[1].description}
            delay={0.31}
          >
            <div className="travel-preview">
              <span className="terra-request-thumb" aria-hidden="true"><RequestIcon /></span>
              <div>
                <strong>{copy.cards[1].preview[0]}</strong>
                <span>{copy.cards[1].preview[1]}</span>
              </div>
              <ArrowCircle />
            </div>
            <AutomationSeal />
          </FeatureCard>

          <FeatureCard
            type="mail"
            icon={<CouncilIcon />}
            title={copy.cards[2].title}
            description={copy.cards[2].description}
            delay={0.44}
          >
            <div className="mail-preview">
              <span className="gmail-mark" aria-hidden="true"><CouncilIcon /></span>
              <div>
                <strong>{copy.cards[2].preview[0]}</strong>
                <span />
                <span />
              </div>
              <ArrowCircle />
            </div>
          </FeatureCard>
        </div>

        <div className="features-stage__floor" aria-hidden="true" />

        <motion.div
          className="features-stats"
          initial={reduceMotion ? false : { opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
        >
          <div className="features-stats__top">
            {dataProfile.reduced ? <div className="features-avatars features-avatars--light" aria-hidden="true"><span>NT</span><span>+</span></div> : <div className="features-avatars" aria-hidden="true">
              <img src={avatarOne} alt="" loading="lazy" decoding="async" width="960" height="720" fetchPriority="low" />
              <img src={avatarTwo} alt="" loading="lazy" decoding="async" width="960" height="720" fetchPriority="low" />
              <img src={avatarThree} alt="" loading="lazy" decoding="async" width="960" height="720" fetchPriority="low" />
            </div>}
            <p><strong>Nova Terra</strong><span>{copy.stat}</span></p>
          </div>
          <p className="features-stats__tasks"><i /> {copy.flow}</p>
        </motion.div>

        <motion.div
          className="features-note"
          initial={reduceMotion ? false : { opacity: 0, rotate: -18, scale: 0.9 }}
          whileInView={{ opacity: 1, rotate: -14, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.66, ease: EASE }}
        >
          <span>{copy.note}</span>
          <svg viewBox="0 0 90 70" aria-hidden="true">
            <path d="M80 4C76 38 50 62 10 58" />
            <path d="M24 46 9 58l15 9" />
          </svg>
          <i />
        </motion.div>
      </motion.div>
    </section>
  );
}