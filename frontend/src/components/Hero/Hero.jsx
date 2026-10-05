import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import "./Hero.css";
import CoreEffect from "./CoreEffect.jsx";
import LanguageSwitcher from "../ui/LanguageSwitcher.jsx";
import { useLocale } from "../../utils/i18n.js";
import { useDataMode } from "../../utils/useDataMode.js";

import heroPhone from "../../assets/hero/hero-phone.webp";
import hero1 from "../../assets/hero/hero-1.webp";

const LEFT_IMAGES = [heroPhone, hero1];
const RIGHT_IMAGES = [hero1, heroPhone];
const IMAGE_INTERVAL_LEFT = 7200;
const IMAGE_INTERVAL_RIGHT = 8800;
const EASE = [0.16, 1, 0.3, 1];

const HERO_TEXT = {
  fr: {
    nav: ["Accueil", "Services", "Actualités", "Contact"],
    login: "Se connecter",
    eyebrow: "VOTRE VILLE, DEMAIN",
    top: "BIENVENUE",
    bottom: ["LA", "VILLE", "ÉVOLUE"],
    subtitle1: "Accédez aux services de la ville, informez-vous, communiquez",
    subtitle2: "et faites remonter vos besoins depuis un même espace.",
    discover: "Découvrir",
    discoverCaption: "UNE VILLE À VOTRE ÉCOUTE",
    start: "Créer mon espace",
    leftCard: ["SERVICES", "CITOYENS", "PLUS PROCHES", "DE VOUS"],
    rightCard: ["UNE VILLE", "PLUS HUMAINE", "PLUS CONNECTÉE", "PLUS DURABLE"],
    altLeft: "Habitante utilisant les services numériques de Nova Terra",
    altRight: "Habitante connectée aux services de Nova Terra",
  },
  en: {
    nav: ["Home", "Services", "News", "Contact"],
    login: "Sign in",
    eyebrow: "YOUR CITY, TOMORROW",
    top: "WELCOME",
    bottom: ["THE", "CITY", "EVOLVES"],
    subtitle1: "Access city services, stay informed and communicate",
    subtitle2: "from one place while sharing the needs that matter to you.",
    discover: "Discover",
    discoverCaption: "A CITY THAT LISTENS",
    start: "Create my space",
    leftCard: ["CITIZEN", "SERVICES", "CLOSER", "TO YOU"],
    rightCard: ["A CITY", "MORE HUMAN", "MORE CONNECTED", "MORE SUSTAINABLE"],
    altLeft: "Resident using Nova Terra digital services",
    altRight: "Resident connected to Nova Terra services",
  },
  mg: {
    nav: ["Fandraisana", "Sampan-draharaha", "Vaovao", "Fifandraisana"],
    login: "Hiditra",
    eyebrow: "NY TANÀNANAO, RAHAMPITSO",
    top: "TONGASOA",
    bottom: ["MIVOATRA", "NY", "TANÀNA"],
    subtitle1: "Midira amin'ny sampan-draharahan'ny tanàna, araho ny vaovao",
    subtitle2: "ary ampitao amin'ny toerana iray ihany ny filànareo.",
    discover: "Hijery",
    discoverCaption: "TANÀNA MIHAINO ANAO",
    start: "Hamorona ny habakako",
    leftCard: ["TOLOTRA", "HO AN'NY", "VAHOAKA", "AKAIKY ANAO"],
    rightCard: ["TANÀNA", "MAHA-OLONA", "MIFANDRAY", "MAHARITRA"],
    altLeft: "Mponina mampiasa ny tolotra nomerika Nova Terra",
    altRight: "Mponina mifandray amin'ny sampan-draharaha Nova Terra",
  },
};

function RotatingImage({
  className,
  images,
  start = 0,
  alt = "",
  intervalMs = 5600,
  active = true,
  priority = false,
}) {
  const [index, setIndex] = useState(start);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reduceMotion || images.length < 2) return undefined;

    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % images.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, images, intervalMs, reduceMotion]);

  return (
    <div className={className}>
      <AnimatePresence mode="sync" initial={false}>
        <motion.img
          key={images[index]}
          src={images[index]}
          alt={alt}
          draggable="false"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.012 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.996 }}
          transition={{ duration: 0.52, ease: EASE }}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          width="960"
          height="720"
        />
      </AnimatePresence>
    </div>
  );
}

function AnimatedWords({ words, delay = 0 }) {
  const reduceMotion = useReducedMotion();

  return words.map((word, index) => (
    <motion.span
      className="hero-word"
      key={`${word}-${index}`}
      initial={reduceMotion ? false : { y: "120%", opacity: 0 }}
      animate={{ y: "0%", opacity: 1 }}
      transition={{
        duration: 0.72,
        delay: reduceMotion ? 0 : delay + index * 0.08,
        ease: EASE,
      }}
    >
      {word}
      {index < words.length - 1 ? "\u00A0" : ""}
    </motion.span>
  ));
}

function TechFrame() {
  return (
    <svg
      className="hero-tech"
      viewBox="0 0 1672 941"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-tech-purple" x1="0" x2="1">
          <stop offset="0" stopColor="#6813ff" stopOpacity="0" />
          <stop offset="0.32" stopColor="#6813ff" stopOpacity=".75" />
          <stop offset="0.7" stopColor="#b05cff" stopOpacity=".76" />
          <stop offset="1" stopColor="#6813ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path className="hero-tech__line hero-tech__line--soft" d="M0 22 H195 L230 10 H598 L632 42 H706" />
      <path className="hero-tech__line hero-tech__line--soft" d="M990 42 H1096 L1131 12 H1444 L1482 44 H1672" />
      <path className="hero-tech__line" d="M0 120 H575 L613 84" />
      <path className="hero-tech__line" d="M1090 84 L1126 120 H1672" />
      <path className="hero-tech__line hero-tech__line--soft" d="M0 740 H464 L500 780 H1040 L1078 740 H1672" />
      <path className="hero-tech__line hero-tech__line--soft" d="M0 898 H456 L492 926 H1170 L1206 898 H1672" />

      <path
        className="hero-tech__line hero-tech__line--glow"
        d="M200 735 C320 606 490 725 638 638 C804 541 1005 663 1200 558 C1320 494 1425 444 1584 430"
      />

      <circle className="hero-tech__dot" cx="506" cy="184" r="3.2" />
      <circle className="hero-tech__dot" cx="1028" cy="178" r="3.2" />
      <circle className="hero-tech__dot" cx="1382" cy="348" r="3.2" />

      <g className="hero-tech__microdots">
        <circle cx="190" cy="300" r="2" />
        <circle cx="205" cy="300" r="2" />
        <circle cx="220" cy="300" r="2" />
        <circle cx="235" cy="300" r="2" />
        <circle cx="190" cy="315" r="2" />
        <circle cx="205" cy="315" r="2" />
        <circle cx="220" cy="315" r="2" />
        <circle cx="235" cy="315" r="2" />
      </g>
    </svg>
  );
}

function InfoCard({ className, lines }) {
  return (
    <div className={`hero-info-card ${className}`} aria-hidden="true">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <i />
    </div>
  );
}

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const dataProfile = useDataMode();
  const [locale] = useLocale();
  const copy = HERO_TEXT[locale] || HERO_TEXT.fr;
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { amount: 0.2, initial: true });
  const richMotionActive = heroInView && !dataProfile.reduced;

  return (
    <main ref={heroRef} className="kamo-hero">
      <TechFrame />

      <div className="kamo-hero__glow kamo-hero__glow--tl" />
      <div className="kamo-hero__glow kamo-hero__glow--right" />
      <div className="kamo-hero__glow kamo-hero__glow--br" />

      {/* Existing opening animation is preserved. */}
      <CoreEffect active={richMotionActive} />

      <motion.header
        className="kamo-header"
        initial={reduceMotion ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
      >
        <nav className="kamo-nav" aria-label="Navigation principale">
          <a className="is-active" href="#home">{copy.nav[0]}</a>
          <a href="/services">{copy.nav[1]}</a>
          <a href="/news">{copy.nav[2]}</a>
          <a href="/contact">{copy.nav[3]}</a>
        </nav>

        <a className="kamo-logo" href="/" aria-label="Nova Terra, accueil">
          Nova<span>Terra</span>
        </a>

        <a className="kamo-login" href="/login">
          <span>{copy.login}</span>
          <i aria-hidden="true">↗</i>
        </a>

        <LanguageSwitcher className="hero-language-switcher" compact />
      </motion.header>

      {!dataProfile.reduced ? (
        <>
          <InfoCard className="hero-info-card--left" lines={copy.leftCard} />
          <InfoCard className="hero-info-card--right" lines={copy.rightCard} />

          <motion.div
            className="hero-photo-shell hero-photo-shell--left"
            initial={reduceMotion ? false : { opacity: 0, x: -48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.95, delay: reduceMotion ? 0 : 3.42, ease: EASE }}
          >
            <div className="hero-photo-shell__backdrop" aria-hidden="true" />
            <RotatingImage
              className="hero-photo"
              images={LEFT_IMAGES}
              start={0}
              alt={copy.altLeft}
              intervalMs={IMAGE_INTERVAL_LEFT}
              active={richMotionActive}
              priority
            />
            <span className="hero-photo-number" aria-hidden="true">01</span>
          </motion.div>

          <motion.div
            className="hero-photo-shell hero-photo-shell--right"
            initial={reduceMotion ? false : { opacity: 0, x: 48, y: -18 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 1, delay: reduceMotion ? 0 : 3.58, ease: EASE }}
          >
            <div className="hero-photo-shell__backdrop" aria-hidden="true" />
            <RotatingImage
              className="hero-photo"
              images={RIGHT_IMAGES}
              start={0}
              alt={copy.altRight}
              intervalMs={IMAGE_INTERVAL_RIGHT}
              active={richMotionActive}
            />
            <span className="hero-photo-number" aria-hidden="true">02</span>
          </motion.div>
        </>
      ) : (
        <div className="hero-low-data-note" role="status">
          Mode léger : visuels décoratifs différés.
        </div>
      )}

      <section className="hero-copy" id="home" aria-labelledby="hero-title">
        <motion.div
          className="hero-eyebrow"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: reduceMotion ? 0 : 2.72, ease: EASE }}
        >
          <i />
          <span>{copy.eyebrow}</span>
          <i />
        </motion.div>

        <h1 className="hero-title" id="hero-title">
          <span className="hero-title__mask">
            <motion.span
              className="hero-title__line-motion"
              initial={reduceMotion ? false : { y: "-135%", opacity: 0, scale: 0.97 }}
              animate={{ y: "0%", opacity: 1, scale: 1 }}
              transition={{ duration: 0.82, delay: reduceMotion ? 0 : 2.86, ease: EASE }}
            >
              <span className="hero-title__top">{copy.top}</span>
            </motion.span>
          </span>

          <motion.span
            className="hero-title__band"
            initial={
              reduceMotion
                ? false
                : { opacity: 0, scaleX: 0.12, scaleY: 0.92 }
            }
            animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
            transition={{ duration: 0.72, delay: reduceMotion ? 0 : 2.94, ease: EASE }}
          >
            <span className="hero-title__band-tech" aria-hidden="true" />
            <span className="hero-title__band-text">
              <AnimatedWords words={["NOVA", "TERRA"]} delay={reduceMotion ? 0 : 3.10} />
            </span>
            <span className="hero-title__band-id" aria-hidden="true">01</span>
          </motion.span>

          <span className="hero-title__mask hero-title__mask--bottom">
            <span className="hero-title__bottom">
              <AnimatedWords words={copy.bottom} delay={reduceMotion ? 0 : 3.18} />
            </span>
          </span>
        </h1>

        <motion.p
          className="hero-subtitle"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, delay: reduceMotion ? 0 : 3.56, ease: EASE }}
        >
          {copy.subtitle1}
          <br />
          {copy.subtitle2}
        </motion.p>
      </section>

      <motion.a
        className="demo-link"
        href="#fonctionnalites"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: reduceMotion ? 0 : 3.82, ease: EASE }}
        whileHover={reduceMotion ? undefined : { x: 3 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        <small>01</small>
        <span className="demo-link__main">
          <b>{copy.discover}</b>
          <i aria-hidden="true">→</i>
        </span>
        <em>{copy.discoverCaption}</em>
      </motion.a>

      <motion.a
        className="start-button"
        href="/inscription"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: reduceMotion ? 0 : 3.75, ease: EASE }}
        whileHover={reduceMotion ? undefined : { y: -3, scale: 1.015 }}
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      >
        <span>{copy.start}</span>
        <i aria-hidden="true">→</i>
      </motion.a>

    </main>
  );
}
