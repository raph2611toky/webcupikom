import { motion, useReducedMotion } from "framer-motion";
import "./Features.css";

import parisTemplateThumb from "../../assets/hero/paris-template-thumb.png";
import avatarOne from "../../assets/hero/hero-1.png";
import avatarTwo from "../../assets/hero/hero-2.png";
import avatarThree from "../../assets/hero/hero-3.png";

const EASE = [0.16, 1, 0.3, 1];

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

function PlaneIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M41.5 8.8c-1.8-1.8-4.6-1.8-6.4 0L27 16.9 11.8 12.8 8.4 16.2l12.2 7.2-7.5 7.5-5.8-1.4-2.9 2.9 7.2 4.3 4.3 7.2 2.9-2.9-1.4-5.8 7.5-7.5 7.2 12.2 3.4-3.4-4.1-15.2 8.1-8.1c1.8-1.8 1.8-4.6 0-6.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="5" y="10" width="38" height="28" rx="6" fill="currentColor" />
      <path d="M9 15.5 24 27l15-11.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" opacity=".96" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 48 36" aria-hidden="true">
      <path d="M5 31V9.5L10.5 5 24 15.2 37.5 5 43 9.5V31a3 3 0 0 1-3 3h-5V14.8L24 23.1 13 14.8V34H8a3 3 0 0 1-3-3Z" fill="#4285F4" />
      <path d="M5 9.5 10.5 5 24 15.2v7.9L5 9.5Z" fill="#EA4335" />
      <path d="m43 9.5-5.5-4.5L24 15.2v7.9L43 9.5Z" fill="#FBBC04" />
      <path d="M5 31V9.5l8 5.7V34H8a3 3 0 0 1-3-3Z" fill="#34A853" />
      <path d="M43 31V9.5l-8 5.7V34h5a3 3 0 0 0 3-3Z" fill="#C5221F" />
    </svg>
  );
}

function ArrowCircle() {
  return (
    <span className="feature-arrow-circle" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M6 12h11M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
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
        </defs>
        <text>
          <textPath href="#seal-top" startOffset="2%">AUTOMATISATION IA · KAMO · </textPath>
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

  return (
    <motion.article
      className={`feature-card feature-card--${type}`}
      initial={reduceMotion ? false : { opacity: 0, rotate: type === "calendar" ? -10.5 : type === "mail" ? 9.2 : 0 }}
      whileInView={{
        opacity: 1,
        rotate: type === "calendar" ? -10.5 : type === "mail" ? 9.2 : 0,
      }}
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
        <span className="features-kicker">Fonctionnalités</span>
        <h2 id="features-title">
          Ce que Kamo <span>automatise</span>
        </h2>
        <p className="features-lead">Kamo organise, recherche, réserve et communique pour vous.</p>
        <p className="features-lead features-lead--soft">Déléguez vos tâches quotidiennes à des agents IA autonomes.</p>
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
          <span>VOTRE QUOTIDIEN, EN PILOTE AUTOMATIQUE</span>
          <h3 className="features-stage__title">
            <span>Des agents IA</span>
            <span>pour chaque</span>
            <span>tâche</span>
            <span>importante</span>
          </h3>
          <i aria-hidden="true" />
        </div>

        <svg className="features-stage__wave" viewBox="0 0 430 140" preserveAspectRatio="none" aria-hidden="true">
          <motion.path
            d="M-18 97 C 72 34, 145 31, 204 77 C 252 115, 307 148, 364 101 C 393 77, 421 55, 453 64"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.75, ease: "easeInOut" }}
          />
        </svg>

        <div className="features-cards" aria-label="Exemples de tâches automatisées">
          <FeatureCard
            type="calendar"
            icon={<CalendarIcon />}
            title="Planifier ma semaine"
            description={<>Organise vos rendez-vous,<br />réunions et tâches<br />automatiquement.</>}
            delay={0.18}
          >
            <div className="calendar-preview">
              <div><strong>09:00</strong><span className="calendar-preview__dot" />Réunion équipe</div>
              <div><strong>11:00</strong><span className="calendar-preview__dot" />Focus travail</div>
            </div>
          </FeatureCard>

          <FeatureCard
            type="travel"
            icon={<PlaneIcon />}
            title="Réserver mes voyages"
            description={<>Trouvez et réservez vos vols,<br />hôtels et déplacements en<br />quelques secondes.</>}
            delay={0.31}
          >
            <div className="travel-preview">
              <img src={parisTemplateThumb} alt="Paris, France" />
              <div>
                <strong>Paris, France</strong>
                <span>12 – 15 Oct.</span>
              </div>
              <ArrowCircle />
            </div>
            <AutomationSeal />
          </FeatureCard>

          <FeatureCard
            type="mail"
            icon={<MailIcon />}
            title="Répondre à mes e-mails"
            description={<>Analyse, rédige et répond<br />à vos e-mails dans votre ton.</>}
            delay={0.44}
          >
            <div className="mail-preview">
              <span className="gmail-mark" aria-hidden="true"><GmailIcon /></span>
              <div>
                <strong>Re: Proposition de partenariat</strong>
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
            <p><strong>12K</strong><span>utilisateurs actifs</span></p>
          </div>
          <p className="features-stats__tasks"><i /> +150K tâches automatisées</p>
        </motion.div>

        <motion.div
          className="features-note"
          initial={reduceMotion ? false : { opacity: 0, rotate: -8, scale: 0.9 }}
          whileInView={{ opacity: 1, rotate: -7, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.66, ease: EASE }}
        >
          <span>Plus de temps<br />pour l’essentiel</span>
          <svg viewBox="0 0 160 112" aria-hidden="true">
            <path d="M141 17c-8 34-32 49-67 53-28 4-45 1-61-10" />
            <path d="M20 50 10 61l14 7" />
          </svg>
          <i />
        </motion.div>
      </motion.div>
    </section>
  );
}
