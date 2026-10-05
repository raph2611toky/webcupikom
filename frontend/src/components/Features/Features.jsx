import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useLocale } from "../../utils/i18n.js";
import { useDataMode } from "../../utils/useDataMode.js";
import "./Features.css";

import avatarOne from "../../assets/hero/hero-1.webp";
import avatarTwo from "../../assets/hero/hero-2.webp";
import avatarThree from "../../assets/hero/hero-3.webp";

const EASE = [0.16, 1, 0.3, 1];

const FEATURES_TEXT = {
  fr: {
    kicker: "Services",
    titleStart: "Une ville",
    titleAccent: "qui évolue",
    lead: "Nova Terra centralise les services, l’information et les besoins de ses habitants.",
    leadSoft: "Un espace numérique qui accompagne la ville à mesure qu’elle grandit.",
    stageKicker: "NOVA TERRA, AU PLUS PRÈS DU QUOTIDIEN",
    stageLines: ["Des services", "pour chaque", "besoin", "de la ville"],
    cards: [
      {
        title: "Services de la ville",
        description: <>Accédez aux services,<br />informations utiles et<br />contenus de la ville.</>,
        preview: ["Informations locales", "Services de la ville"],
      },
      {
        title: "Exprimer un besoin",
        description: <>Faites remonter un besoin,<br />communiquez ou signalez<br />un problème simplement.</>,
        preview: ["Besoin citoyen", "Envoyer une demande"],
      },
      {
        title: "Rester informé",
        description: <>Suivez les informations<br />et les nouveaux services<br />de Nova Terra.</>,
        preview: ["Haut Conseil · Information"],
      },
    ],
    stat: "ville en évolution",
    flow: "Flux vivant de besoins",
    note: <>Plus simple<br />pour vivre la ville</>,
    aria: "Exemples de services de Nova Terra",
    index: ["SERVICES", "CITOYENS"],
    rail: ["SERVICES", "CITOYENS", "ACTIONS"],
    micro: ["UNE VILLE", "PLUS HUMAINE", "PLUS CONNECTÉE", "PLUS DURABLE"],
  },
  en: {
    kicker: "Services",
    titleStart: "A city",
    titleAccent: "that evolves",
    lead: "Nova Terra brings city services, information and residents’ needs together.",
    leadSoft: "A digital space that grows with the city.",
    stageKicker: "NOVA TERRA, CLOSER TO EVERYDAY LIFE",
    stageLines: ["Services", "for every", "city", "need"],
    cards: [
      {
        title: "City services",
        description: <>Access services,<br />useful information and<br />city content.</>,
        preview: ["Local information", "City services"],
      },
      {
        title: "Share a need",
        description: <>Ask a question,<br />communicate or report<br />an issue simply.</>,
        preview: ["Citizen request", "Send a request"],
      },
      {
        title: "Stay informed",
        description: <>Follow city information<br />and new services<br />in Nova Terra.</>,
        preview: ["High Council · Information"],
      },
    ],
    stat: "evolving city",
    flow: "Live flow of needs",
    note: <>A simpler way<br />to live the city</>,
    aria: "Examples of Nova Terra services",
    index: ["SERVICES", "CITIZENS"],
    rail: ["SERVICES", "CITIZENS", "ACTIONS"],
    micro: ["A CITY", "MORE HUMAN", "MORE CONNECTED", "MORE SUSTAINABLE"],
  },
  mg: {
    kicker: "Sampan-draharaha",
    titleStart: "Tanàna",
    titleAccent: "mivoatra",
    lead: "Nova Terra dia manangona amin’ny toerana iray ny sampan-draharaha, ny vaovao ary ny filàn’ny mponina.",
    leadSoft: "Habaka nomerika iray izay miara-mivoatra amin’ny tanàna.",
    stageKicker: "NOVA TERRA, AKAIKY NY FIAINANA ANDAVANANDRO",
    stageLines: ["Tolotra", "ho an'ny", "filàna", "rehetra"],
    cards: [
      {
        title: "Sampan-draharahan'ny tanàna",
        description: <>Midira amin'ny tolotra,<br />vaovao ilaina ary<br />votoatin'ny tanàna.</>,
        preview: ["Vaovao eo an-toerana", "Sampan-draharaha"],
      },
      {
        title: "Ampitao ny filàna",
        description: <>Mametraha fanontaniana,<br />mifandraisa na mitatitra<br />olana mora foana.</>,
        preview: ["Filàn'ny mponina", "Handefa fangatahana"],
      },
      {
        title: "Mahazoa vaovao",
        description: <>Araho ny vaovao<br />sy ny tolotra vaovao<br />ao Nova Terra.</>,
        preview: ["Filankevitra Ambony · Vaovao"],
      },
    ],
    stat: "tanàna mivoatra",
    flow: "Filàna havaozina hatrany",
    note: <>Mora kokoa<br />ny miaina an-tanàna</>,
    aria: "Ohatra amin'ny sampan-draharaha Nova Terra",
    index: ["TOLOTRA", "VAHOAKA"],
    rail: ["TOLOTRA", "VAHOAKA", "HETSIKA"],
    micro: ["TANÀNA", "MAHA-OLONA", "MIFANDRAY", "MAHARITRA"],
  },
};

const DEBRIS = [
  { id: 1, cls: "debris-long", left: "5.5%", top: "4%", x: -150, y: -360, r: -32 },
  { id: 2, cls: "debris-diamond", left: "12%", top: "8%", x: -100, y: -410, r: 74 },
  { id: 3, cls: "debris-bar", left: "22%", top: "2%", x: -42, y: -320, r: -18 },
  { id: 4, cls: "debris-cut", left: "39%", top: "1%", x: -24, y: -390, r: 52 },
  { id: 5, cls: "debris-cut debris-cut--right", left: "61%", top: "1%", x: 24, y: -400, r: -48 },
  { id: 6, cls: "debris-bar", left: "75%", top: "2%", x: 62, y: -330, r: 22 },
  { id: 7, cls: "debris-diamond", left: "88%", top: "8%", x: 102, y: -420, r: -72 },
  { id: 8, cls: "debris-long debris-long--right", left: "94%", top: "4%", x: 150, y: -360, r: 34 },
];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 10h24a5 5 0 0 1 5 5v21a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5Z" fill="currentColor" />
      <path d="M7 19h34v4H7z" fill="#fff" opacity=".96" />
      <path d="M16 7v8M32 7v8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="13" y="26" width="6" height="5" rx="1.4" fill="#fff" />
      <rect x="21" y="26" width="6" height="5" rx="1.4" fill="#fff" />
      <rect x="29" y="26" width="6" height="5" rx="1.4" fill="#fff" />
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
        <path d="M7.25 12h8.35M12.85 8.4 16.45 12l-3.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function AutomationSeal() {
  return (
    <div className="automation-seal" aria-hidden="true">
      <svg viewBox="0 0 170 170">
        <defs>
          <path id="seal-top-features" d="M85,85 m-56,0 a56,56 0 1,1 112,0 a56,56 0 1,1 -112,0" />
          <path id="seal-bottom-features" d="M85,85 m-66,0 a66,66 0 1,0 132,0 a66,66 0 1,0 -132,0" />
        </defs>
        <text><textPath href="#seal-top-features" startOffset="25%" textAnchor="middle">NOVA TERRA</textPath></text>
        <text><textPath href="#seal-bottom-features" startOffset="25%" textAnchor="middle">VILLE · CITOYENS</textPath></text>
      </svg>
      <span className="automation-seal__star">✦</span>
      <span className="automation-seal__dot automation-seal__dot--left" />
      <span className="automation-seal__dot automation-seal__dot--right" />
    </div>
  );
}

const CARD_MOTION = {
  /* 01 appears first */
  calendar: {
    range: [0.08, 0.18, 0.30],
    x: [-150, -28, 0],
    y: [-145, -30, 0],
    rotate: [-28, -16, -12],
    scale: [0.88, 0.98, 1],
  },

  /* 02 starts only after card 01 is almost complete */
  travel: {
    range: [0.32, 0.42, 0.54],
    x: [0, 0, 0],
    y: [-145, -30, 0],
    rotate: [0, 0, 0],
    scale: [0.86, 0.98, 1],
  },

  /* 03 appears last */
  mail: {
    range: [0.56, 0.66, 0.78],
    x: [150, 30, 0],
    y: [-145, -30, 0],
    rotate: [28, 16, 12],
    scale: [0.88, 0.98, 1],
  },
};

function FeatureCard({
  type,
  icon,
  title,
  description,
  children,
  progress,
  reduceMotion,
}) {
  const config = CARD_MOTION[type];

  const opacity = useTransform(
    progress,
    config.range,
    [0, 0.88, 1],
  );
  const x = useTransform(progress, config.range, config.x);
  const y = useTransform(progress, config.range, config.y);
  const rotate = useTransform(progress, config.range, config.rotate);
  const scale = useTransform(progress, config.range, config.scale);

  return (
    <motion.article
      className={`feature-card feature-card--${type}`}
      style={
        reduceMotion
          ? {
              opacity: 1,
              x: 0,
              y: 0,
              rotate: config.rotate.at(-1),
              scale: 1,
            }
          : {
              opacity,
              x,
              y,
              rotate,
              scale,
            }
      }
    >
      <div className="feature-card__surface">
        <div className="feature-card__tech" aria-hidden="true">///</div>
        <div className="feature-card__number" aria-hidden="true">
          {type === "calendar" ? "01" : type === "travel" ? "02" : "03"}
        </div>
        <div className="feature-card__icon">{icon}</div>
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
      </div>
    </motion.article>
  );
}

function DebrisPiece({ progress, piece }) {
  const x = useTransform(progress, [0, 0.45, 1], [piece.x, piece.x * 0.28, 0]);
  const y = useTransform(progress, [0, 0.45, 1], [piece.y, piece.y * 0.18, 0]);
  const rotate = useTransform(progress, [0, 0.55, 1], [piece.r, piece.r * 0.2, 0]);
  const opacity = useTransform(progress, [0, 0.1, 0.65, 1], [0, 0.78, 0.92, 0.92]);

  return (
    <motion.span
      className={`features-debris__piece ${piece.cls}`}
      style={{ left: piece.left, top: piece.top, x, y, rotate, opacity }}
      aria-hidden="true"
    />
  );
}

function StageTechBackground() {
  return (
    <svg className="features-stage__tech" viewBox="0 0 1600 560" preserveAspectRatio="none" aria-hidden="true">
      <path d="M22 42H380l28 22h220" />
      <path d="M950 64h215l28-22h385" />
      <path d="M28 480h220l35-31h170" />
      <path d="M1135 454h190l37-34h205" />
      <path className="is-glow" d="M320 352 C470 260 600 390 770 310 C920 240 1110 320 1270 230" />
      <circle cx="395" cy="64" r="3" />
      <circle cx="1186" cy="42" r="3" />
      <circle cx="283" cy="449" r="3" />
      <circle cx="1350" cy="420" r="3" />
    </svg>
  );
}

export default function Features() {
  const sectionRef = useRef(null);
  const systemReduceMotion = useReducedMotion();
  const dataProfile = useDataMode();
  const reduceMotion = systemReduceMotion || dataProfile.reduced;
  const [locale] = useLocale();
  const copy = FEATURES_TEXT[locale] || FEATURES_TEXT.fr;

  /*
   * One short scroll window controls the complete reconstruction.
   *
   * 0 -> the second page starts entering the viewport.
   * 1 -> its top reaches 52% of the viewport.
   *
   * The cards reach their final state by progress 0.52, so the section
   * cannot remain half-built after the user has clearly entered page 02.
   */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    /*
     * Reveal is intentionally spread across a longer downward scroll:
     * 01 -> 02 -> 03.
     * It reaches 100% before the section top reaches 18% of the viewport,
     * so the animation still always finishes.
     */
    offset: ["start 98%", "start 18%"],
  });

  const assemblyProgress = useSpring(scrollYProgress, {
    stiffness: 190,
    damping: 30,
    mass: 0.48,
    restDelta: 0.001,
  });

  const debrisRaw = useTransform(
    assemblyProgress,
    [0, 0.18, 0.62, 0.86],
    [0, 0.12, 0.82, 1],
  );

  const debrisProgress = useSpring(debrisRaw, {
    stiffness: 175,
    damping: 27,
    mass: 0.5,
    restDelta: 0.001,
  });

  // -----------------------------------------------------------------
  // Text reveal uses the exact same scroll source as the cards.
  // No whileInView: this avoids text getting stuck at opacity: 0.
  // -----------------------------------------------------------------
  const kickerOpacity = useTransform(assemblyProgress, [0, 0.045, 0.11], [0, 0.72, 1]);
  const kickerY = useTransform(assemblyProgress, [0, 0.11], [-10, 0]);

  const titleOpacity = useTransform(assemblyProgress, [0.035, 0.11, 0.19], [0, 0.72, 1]);
  const titleY = useTransform(assemblyProgress, [0.035, 0.19], [22, 0]);

  const leadOpacity = useTransform(assemblyProgress, [0.09, 0.17, 0.25], [0, 0.78, 1]);
  const leadY = useTransform(assemblyProgress, [0.09, 0.25], [14, 0]);

  const softLeadOpacity = useTransform(assemblyProgress, [0.13, 0.22, 0.30], [0, 0.8, 1]);
  const softLeadY = useTransform(assemblyProgress, [0.13, 0.30], [12, 0]);

  const stageKickerOpacity = useTransform(assemblyProgress, [0.11, 0.18, 0.25], [0, 0.8, 1]);
  const stageKickerX = useTransform(assemblyProgress, [0.11, 0.25], [-14, 0]);

  const stageLine1Opacity = useTransform(assemblyProgress, [0.16, 0.23, 0.30], [0, 0.82, 1]);
  const stageLine1X = useTransform(assemblyProgress, [0.16, 0.30], [-18, 0]);

  const stageLine2Opacity = useTransform(assemblyProgress, [0.20, 0.27, 0.34], [0, 0.82, 1]);
  const stageLine2X = useTransform(assemblyProgress, [0.20, 0.34], [-18, 0]);

  const stageLine3Opacity = useTransform(assemblyProgress, [0.24, 0.31, 0.38], [0, 0.82, 1]);
  const stageLine3X = useTransform(assemblyProgress, [0.24, 0.38], [-18, 0]);

  const stageLine4Opacity = useTransform(assemblyProgress, [0.28, 0.35, 0.42], [0, 0.82, 1]);
  const stageLine4X = useTransform(assemblyProgress, [0.28, 0.42], [-18, 0]);

  const stageUnderlineOpacity = useTransform(assemblyProgress, [0.30, 0.37, 0.44], [0, 0.8, 1]);
  const stageUnderlineScale = useTransform(assemblyProgress, [0.30, 0.44], [0, 1]);

  return (
    <section
      ref={sectionRef}
      className="features-section"
      id="fonctionnalites"
      aria-labelledby="features-title"
    >
      <div className="features-section__texture" aria-hidden="true" />

      <svg className="features-heading-tech" viewBox="0 0 1600 310" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 32h200l32 28h388" />
        <path d="M980 60h370l28-28h222" />
        <path d="M0 285h285l34-36h205" />
        <path d="M1090 249h205l34 36h271" />
        <circle cx="608" cy="60" r="3" />
        <circle cx="994" cy="60" r="3" />
        <circle cx="1280" cy="250" r="3" />
      </svg>

      <div className="features-microcopy" aria-hidden="true">
        {copy.micro.map((item) => <span key={item}>{item}</span>)}
        <i />
      </div>

      <div className="features-heading">
        <motion.span
          className="features-kicker"
          style={
            reduceMotion
              ? undefined
              : { opacity: kickerOpacity, y: kickerY }
          }
        >
          {copy.kicker}
        </motion.span>

        <motion.h2
          id="features-title"
          style={
            reduceMotion
              ? undefined
              : { opacity: titleOpacity, y: titleY }
          }
        >
          {copy.titleStart} <span>{copy.titleAccent}</span>
        </motion.h2>

        <motion.p
          className="features-lead"
          style={
            reduceMotion
              ? undefined
              : { opacity: leadOpacity, y: leadY }
          }
        >
          {copy.lead}
        </motion.p>

        <motion.p
          className="features-lead features-lead--soft"
          style={
            reduceMotion
              ? undefined
              : { opacity: softLeadOpacity, y: softLeadY }
          }
        >
          {copy.leadSoft}
        </motion.p>
      </div>

      <div className="features-stage-shell">
        {!reduceMotion ? (
          <div className="features-debris" aria-hidden="true">
            {DEBRIS.map((piece) => (
              <DebrisPiece key={piece.id} progress={debrisProgress} piece={piece} />
            ))}
          </div>
        ) : null}

        <div className="features-stage">
          <StageTechBackground />

          <div className="features-stage__intro">
            <motion.span
              style={
                reduceMotion
                  ? undefined
                  : { opacity: stageKickerOpacity, x: stageKickerX }
              }
            >
              {copy.stageKicker}
            </motion.span>

            <h3>
              {copy.stageLines.map((line, index) => {
                const opacityValues = [
                  stageLine1Opacity,
                  stageLine2Opacity,
                  stageLine3Opacity,
                  stageLine4Opacity,
                ];
                const xValues = [
                  stageLine1X,
                  stageLine2X,
                  stageLine3X,
                  stageLine4X,
                ];

                return (
                  <motion.span
                    key={line}
                    style={
                      reduceMotion
                        ? undefined
                        : {
                            opacity: opacityValues[index],
                            x: xValues[index],
                          }
                    }
                  >
                    {line}
                  </motion.span>
                );
              })}
            </h3>

            <motion.i
              aria-hidden="true"
              style={
                reduceMotion
                  ? undefined
                  : {
                      opacity: stageUnderlineOpacity,
                      scaleX: stageUnderlineScale,
                    }
              }
            />
          </div>

          <div className="features-stage__index" aria-hidden="true">
            <b>01</b>
            {copy.index.map((item) => <span key={item}>{item}</span>)}
            <i />
          </div>

          <div className="features-cards" aria-label={copy.aria}>
            <FeatureCard
              type="calendar"
              icon={<CalendarIcon />}
              title={copy.cards[0].title}
              description={copy.cards[0].description}
              progress={assemblyProgress}
              reduceMotion={reduceMotion}
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
              progress={assemblyProgress}
              reduceMotion={reduceMotion}
            >
              <div className="travel-preview">
                <span className="terra-request-thumb" aria-hidden="true"><RequestIcon /></span>
                <div>
                  <strong>{copy.cards[1].preview[0]}</strong>
                  <span>{copy.cards[1].preview[1]}</span>
                </div>
                <ArrowCircle />
              </div>
            </FeatureCard>

            <FeatureCard
              type="mail"
              icon={<CouncilIcon />}
              title={copy.cards[2].title}
              description={copy.cards[2].description}
              progress={assemblyProgress}
              reduceMotion={reduceMotion}
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

          <div className="features-stats">
            <div className="features-stats__top">
              <div className="features-avatars" aria-hidden="true">
                <img src={avatarOne} alt="" loading="lazy" decoding="async" />
                <img src={avatarTwo} alt="" loading="lazy" decoding="async" />
                <img src={avatarThree} alt="" loading="lazy" decoding="async" />
              </div>
              <p><strong>Nova Terra</strong><span>{copy.stat}</span></p>
            </div>
            <p className="features-stats__tasks"><i /> {copy.flow}</p>
          </div>

          <div className="features-note">
            <span>{copy.note}</span>
            <svg viewBox="0 0 92 75" aria-hidden="true">
              <path d="M80 4C76 38 50 64 10 60" />
              <path d="M24 48 9 60l15 9" />
            </svg>
            <i />
          </div>

          <div className="features-stage__rail" aria-hidden="true">
            {copy.rail.map((item, index) => (
              <span key={item}>{item}<i className={index === 0 ? "is-active" : ""} /></span>
            ))}
          </div>

          <div className="features-stage__seal"><AutomationSeal /></div>
        </div>
      </div>
    </section>
  );
}
