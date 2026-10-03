import { motion, useReducedMotion } from "framer-motion";
import "./Features.css";

import avatarOne from "../../assets/hero/hero-1.webp";
import avatarTwo from "../../assets/hero/hero-2.webp";
import avatarThree from "../../assets/hero/hero-3.webp";

const EASE = [0.16, 1, 0.3, 1];

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
  const reduceMotion = useReducedMotion();

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
        <span className="features-kicker">Services</span>
        <h2 id="features-title">
          Une ville <span>qui évolue</span>
        </h2>
        <p className="features-lead">Nova Terra centralise les services, l’information et les besoins de ses habitants.</p>
        <p className="features-lead features-lead--soft">Un espace numérique qui accompagne la ville à mesure qu’elle grandit.</p>
      </motion.div>

      <HeaderSparkles />

      <motion.div
        className="features-stage"
        initial={reduceMotion ? false : { opacity: 0, y: 42, scale: 0.985 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.85, delay: 0.12, ease: EASE }}
      >
        <div className="features-stage__intro">
          <span>NOVA TERRA, AU PLUS PRÈS DU QUOTIDIEN</span>
          <h3 className="features-stage__title">
            <span>Des services</span>
            <span>pour chaque</span>
            <span>besoin</span>
            <span>de la ville</span>
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

        <div className="features-cards" aria-label="Exemples de services de Nova Terra">
          <FeatureCard
            type="calendar"
            icon={<CalendarIcon />}
            title="Services de la ville"
            description={<>Accédez aux services,<br />informations utiles et<br />contenus de la ville.</>}
            delay={0.18}
          >
            <div className="calendar-preview">
              <div><strong>01</strong><span className="calendar-preview__dot" />Informations locales</div>
              <div><strong>02</strong><span className="calendar-preview__dot" />Services de la ville</div>
            </div>
          </FeatureCard>

          <FeatureCard
            type="travel"
            icon={<RequestIcon />}
            title="Exprimer un besoin"
            description={<>Faites remonter un besoin,<br />communiquez ou signalez<br />un problème simplement.</>}
            delay={0.31}
          >
            <div className="travel-preview">
              <span className="terra-request-thumb" aria-hidden="true"><RequestIcon /></span>
              <div>
                <strong>Besoin citoyen</strong>
                <span>Envoyer une demande</span>
              </div>
              <ArrowCircle />
            </div>
            <AutomationSeal />
          </FeatureCard>

          <FeatureCard
            type="mail"
            icon={<CouncilIcon />}
            title="Rester informé"
            description={<>Suivez les informations<br />et les nouveaux services<br />de Nova Terra.</>}
            delay={0.44}
          >
            <div className="mail-preview">
              <span className="gmail-mark" aria-hidden="true"><CouncilIcon /></span>
              <div>
                <strong>Haut Conseil · Information</strong>
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
            <div className="features-avatars" aria-hidden="true">
              <img src={avatarOne} alt="" />
              <img src={avatarTwo} alt="" />
              <img src={avatarThree} alt="" />
            </div>
            <p><strong>Nova Terra</strong><span>ville en évolution</span></p>
          </div>
          <p className="features-stats__tasks"><i /> Flux vivant de besoins</p>
        </motion.div>

        <motion.div
          className="features-note"
          initial={reduceMotion ? false : { opacity: 0, rotate: -18, scale: 0.9 }}
          whileInView={{ opacity: 1, rotate: -14, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.66, ease: EASE }}
        >
          <span>Plus simple<br />pour vivre la ville</span>
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