import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "../../utils/i18n.js";
import { useDataMode } from "../../utils/useDataMode.js";
import "./Mission.css";

const EASE = [0.16, 1, 0.3, 1];

const COPY = {
  fr: {
    kicker: "Notre mission",
    titleStart: "Faire grandir Nova Terra",
    titleAccent: "avec ses habitants.",
    intro: "Nova Terra grandit : son espace numérique doit accompagner",
    intro2: "les nouveaux besoins de ses habitants.",
    sideLeft: ["Des services", "à portée de main"],
    sideRight: ["Une ville", "plus connectée"],
    items: [
      {
        index: "01",
        title: "Accéder",
        text: "Retrouvez plus simplement les informations et services utiles de Nova Terra.",
        icon: "grid",
      },
      {
        index: "02",
        title: "Communiquer",
        text: "Exprimez un besoin, transmettez une information ou signalez un problème à la ville.",
        icon: "chat",
      },
      {
        index: "03",
        title: "Évoluer",
        text: "La plateforme est pensée pour accueillir de nouveaux services à mesure que les besoins apparaissent.",
        icon: "chart",
      },
    ],
  },
  en: {
    kicker: "Our mission",
    titleStart: "Grow Nova Terra",
    titleAccent: "with its residents.",
    intro: "As Nova Terra grows, its digital space must keep up",
    intro2: "with residents’ new needs.",
    sideLeft: ["Services", "within easy reach"],
    sideRight: ["A city", "more connected"],
    items: [
      {
        index: "01",
        title: "Access",
        text: "Find useful Nova Terra information and services more easily.",
        icon: "grid",
      },
      {
        index: "02",
        title: "Communicate",
        text: "Ask for help, share information or report a city issue.",
        icon: "chat",
      },
      {
        index: "03",
        title: "Evolve",
        text: "The platform is designed to welcome new services as new needs appear.",
        icon: "chart",
      },
    ],
  },
  mg: {
    kicker: "Ny iraka ataonay",
    titleStart: "Hampivoatra an'i Nova Terra",
    titleAccent: "miaraka amin'ny mponina.",
    intro: "Rehefa mivoatra i Nova Terra dia tsy maintsy manaraka",
    intro2: "ny filàn'ny mponina koa ny habaka nomerika.",
    sideLeft: ["Tolotra", "akaiky anao"],
    sideRight: ["Tanàna", "mifandray kokoa"],
    items: [
      {
        index: "01",
        title: "Miditra",
        text: "Tadiavo mora kokoa ny vaovao sy ny sampan-draharaha ilaina ao Nova Terra.",
        icon: "grid",
      },
      {
        index: "02",
        title: "Mifandray",
        text: "Ampitao ny filànao, zarao ny vaovao na mitatitra olana amin'ny tanàna.",
        icon: "chat",
      },
      {
        index: "03",
        title: "Mivoatra",
        text: "Natao handray sampan-draharaha vaovao ny sehatra rehefa miseho ny filàna vaovao.",
        icon: "chart",
      },
    ],
  },
};

function MissionIcon({ type }) {
  if (type === "chat") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M24 8c9.2 0 16.7 6.3 16.7 14.2S33.2 36.4 24 36.4c-2 0-4-.3-5.8-.9L10 41l2.6-8.4C9.2 30 7.3 26.3 7.3 22.2 7.3 14.3 14.8 8 24 8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="17.5" cy="22" r="2" fill="currentColor" />
        <circle cx="24" cy="22" r="2" fill="currentColor" />
        <circle cx="30.5" cy="22" r="2" fill="currentColor" />
      </svg>
    );
  }

  if (type === "chart") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 39h30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M13 34V24h6v10M23 34V18h6v16M33 34V12h6v22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="m12 18 9-6 7 3 10-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="28" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="8" y="28" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="28" y="28" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function MissionCard({ item, index, reduceMotion }) {
  const fromX = index === 0 ? -56 : index === 2 ? 56 : 0;
  const fromY = index === 1 ? 54 : 30;

  return (
    <motion.article
      className="terra-mission__card"
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              x: fromX,
              y: fromY,
              scale: 0.94,
            }
      }
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
      }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{
        duration: 0.78,
        delay: reduceMotion ? 0 : 0.08 + index * 0.13,
        ease: EASE,
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              scale: 1.008,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
    >
      <motion.span
        className="terra-mission__index"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.42,
          delay: reduceMotion ? 0 : 0.34 + index * 0.13,
          ease: EASE,
        }}
      >
        {item.index}
      </motion.span>

      <motion.div
        className="terra-mission__icon"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.55, rotate: -12 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.58,
          delay: reduceMotion ? 0 : 0.28 + index * 0.13,
          ease: EASE,
        }}
      >
        <MissionIcon type={item.icon} />
      </motion.div>

      <motion.h3
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.5,
          delay: reduceMotion ? 0 : 0.40 + index * 0.13,
          ease: EASE,
        }}
      >
        {item.title}
      </motion.h3>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.54,
          delay: reduceMotion ? 0 : 0.46 + index * 0.13,
          ease: EASE,
        }}
      >
        {item.text}
      </motion.p>

      <motion.a
        className="terra-mission__arrow"
        href="#fonctionnalites"
        aria-label={item.title}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.46,
          delay: reduceMotion ? 0 : 0.5 + index * 0.13,
          ease: EASE,
        }}
        whileHover={reduceMotion ? undefined : { x: 3, scale: 1.05 }}
      >
        →
      </motion.a>

      <span className="terra-mission__tech" aria-hidden="true">///</span>
      <span className="terra-mission__scan" aria-hidden="true" />
    </motion.article>
  );
}

export default function Mission() {
  const systemReduceMotion = useReducedMotion();
  const dataProfile = useDataMode();
  const reduceMotion = systemReduceMotion || dataProfile.reduced;
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;

  return (
    <section className="terra-mission" id="mission" aria-labelledby="mission-title">
      <svg
        className="terra-mission__tech-bg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 36h210l34 30h352" />
        <path d="M1000 66h345l36-30h219" />
        <path d="M0 816h360l42-34h260" />
        <path d="M935 782h263l42 34h360" />
        <path className="is-arc" d="M236 384C410 224 604 180 800 180s390 44 564 204" />
        <path className="is-arc is-arc--lower" d="M170 620C414 780 620 748 800 748s386 32 630-128" />
        <circle cx="220" cy="66" r="3" />
        <circle cx="1380" cy="66" r="3" />
        <circle cx="400" cy="782" r="3" />
        <circle cx="1200" cy="782" r="3" />
      </svg>

      <motion.div
        className="terra-mission__side-note terra-mission__side-note--left"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0, x: -28 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.65 }}
        transition={{ duration: 0.62, delay: reduceMotion ? 0 : 0.18, ease: EASE }}
      >
        <i />
        <span>{copy.sideLeft[0]}</span>
        <span>{copy.sideLeft[1]}</span>
      </motion.div>

      <motion.div
        className="terra-mission__side-note terra-mission__side-note--right"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0, x: 28 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.65 }}
        transition={{ duration: 0.62, delay: reduceMotion ? 0 : 0.24, ease: EASE }}
      >
        <span>{copy.sideRight[0]}</span>
        <span>{copy.sideRight[1]}</span>
        <i />
      </motion.div>

      <motion.div
        className="terra-mission__head"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: reduceMotion ? 0 : 0.11,
            },
          },
        }}
      >
        <motion.span
          className="terra-mission__kicker"
          variants={{
            hidden: reduceMotion ? {} : { opacity: 0, y: -12, scale: 0.96 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={{ duration: 0.48, ease: EASE }}
        >
          {copy.kicker}
        </motion.span>

        <motion.h2
          id="mission-title"
          variants={{
            hidden: reduceMotion ? {} : { opacity: 0, y: 28, filter: "blur(5px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
          transition={{ duration: 0.72, ease: EASE }}
        >
          <span className="terra-mission__title-base">{copy.titleStart}</span>{" "}
          <motion.span
            className="terra-mission__title-accent"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.62, delay: reduceMotion ? 0 : 0.24, ease: EASE }}
          >
            {copy.titleAccent}
          </motion.span>
        </motion.h2>

        <motion.p
          variants={{
            hidden: reduceMotion ? {} : { opacity: 0, y: 18 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.58, ease: EASE }}
        >
          {copy.intro}
          <br />
          {copy.intro2}
        </motion.p>
      </motion.div>

      <div className="terra-mission__grid">
        {copy.items.map((item, index) => (
          <MissionCard
            key={item.index}
            item={item}
            index={index}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </section>
  );
}
