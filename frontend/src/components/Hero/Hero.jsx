import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import "./Hero.css";
import CoreEffect from "./CoreEffect.jsx";

import heroPhone from "../../assets/hero/hero-phone.webp";
import hero1 from "../../assets/hero/hero-1.webp";

// Keep each side coherent, but avoid repeating the same visual every second.
const LEFT_IMAGES = [heroPhone, hero1];
const RIGHT_IMAGES = [hero1, heroPhone];
const IMAGE_INTERVAL_LEFT = 7200;
const IMAGE_INTERVAL_RIGHT = 8800;
const EASE = [0.16, 1, 0.3, 1];

function RotatingImage({ className, images, start = 0, alt = "", intervalMs = 5600, active = true }) {
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
          initial={
            reduceMotion
              ? false
              : { opacity: 0, scale: 1.008 }
          }
          animate={{ opacity: 1, scale: 1 }}
          exit={
            reduceMotion
              ? undefined
              : { opacity: 0, scale: 0.997 }
          }
          transition={{ duration: 0.52, ease: EASE }}
          decoding="async"
        />
      </AnimatePresence>
    </div>
  );
}

function OrbitText({ active = true }) {
  const id = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();

  return (
    <motion.svg
      className="kamo-orbit"
      viewBox="0 0 230 230"
      aria-hidden="true"
      initial={{ rotate: -12 }}
      animate={{ rotate: reduceMotion || !active ? -12 : 348 }}
      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
      transition={
        reduceMotion || !active
          ? { duration: 0.2 }
          : {
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 0.25, ease: "easeOut" },
            }
      }
    >
      <defs>
        <path
          id={id}
          d="M115,115 m-66,0 a66,66 0 1,1 132,0 a66,66 0 1,1 -132,0"
        />
      </defs>
      <text>
        <textPath href={`#${id}`} startOffset="1%">
          NOVA TERRA · SERVICES · CITOYENS · VILLE · NOVA TERRA ·
        </textPath>
      </text>
      <circle className="dot d1" cx="49" cy="114" r="4.1" />
      <circle className="dot d2" cx="115" cy="49" r="4.1" />
      <circle className="dot d3" cx="181" cy="113" r="4.1" />
    </motion.svg>
  );
}

function Scribbles() {
  const reduceMotion = useReducedMotion();
  const pathAnimation = reduceMotion
    ? { pathLength: 1, opacity: 1 }
    : { pathLength: 1, opacity: 1 };

  return (
    <>
      <svg
        className="scribble scribble-left"
        viewBox="0 0 90 120"
        aria-hidden="true"
      >
        <motion.path
          d="M72 7C59 21 48 33 37 48c-7 10-8 18-3 21 7 4 19-9 28-12 7-2 13 2 11 9-2 8-11 15-20 24"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={pathAnimation}
          transition={{ duration: 1.05, delay: reduceMotion ? 0 : 3.50, ease: "easeInOut" }}
        />
      </svg>

      <svg
        className="scribble scribble-right"
        viewBox="0 0 110 110"
        aria-hidden="true"
      >
        <motion.path
          d="M29 8c-5 25-5 39 3 38 8-1 12-29 19-29 10 0 5 36 12 46 8 10 23-10 32-24"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={pathAnimation}
          transition={{ duration: 1.0, delay: reduceMotion ? 0 : 3.56, ease: "easeInOut" }}
        />
      </svg>
    </>
  );
}

function Sparkles({ active = true }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className="demo-sparkles"
      aria-hidden="true"
      animate={
        reduceMotion || !active
          ? { rotate: 0, scale: 1 }
          : { rotate: [0, 8, -4, 0], scale: [1, 1.08, 1, 1] }
      }
      transition={{ duration: active && !reduceMotion ? 2.6 : 0.2, repeat: active && !reduceMotion ? Infinity : 0, repeatDelay: 0.7 }}
    >
      <span className="spark spark-big">✦</span>
      <span className="spark spark-small">✦</span>
    </motion.span>
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

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { amount: 0.2, initial: true });
  return (
    <main ref={heroRef} className="kamo-hero">
      <div className="kamo-hero__glow kamo-hero__glow--tl" />
      <div className="kamo-hero__glow kamo-hero__glow--right" />
      <div className="kamo-hero__glow kamo-hero__glow--br" />

      <CoreEffect active={heroInView} />

      <motion.header
        className="kamo-header"
        initial={reduceMotion ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
      >
        <nav className="kamo-nav" aria-label="Navigation principale">
          <a href="#home">Accueil</a>
          <a href="/services">Services</a>
          <a href="/news">Actualités</a>
          <a href="/contact">Contact</a>
        </nav>

        <a className="kamo-logo" href="/" aria-label="Nova Terra, accueil">
          Nova<span>Terra</span>
        </a>

        <a className="kamo-login" href="/login">
          Se connecter
        </a>
      </motion.header>

      <motion.div
        className="hero-photo-motion hero-photo-motion--left"
        initial={reduceMotion ? false : { opacity: 0, x: -45 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.95, delay: reduceMotion ? 0 : 3.42, ease: EASE }}
      >
        <RotatingImage
          className="hero-photo hero-photo--left"
          images={LEFT_IMAGES}
          start={0}
          alt="Habitante utilisant les services numériques de Nova Terra"
          intervalMs={IMAGE_INTERVAL_LEFT}
          active={heroInView}
        />
      </motion.div>

      <motion.div
        className="hero-top-right-motion"
        initial={reduceMotion ? false : { opacity: 0, x: 45, y: -20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 1.0, delay: reduceMotion ? 0 : 3.58, ease: EASE }}
      >
        <div className="hero-top-right" aria-hidden="true">
          <OrbitText active={heroInView} />
          <RotatingImage
            className="hero-photo hero-photo--right"
            images={RIGHT_IMAGES}
            start={0}
            alt="Habitante connectée aux services de Nova Terra"
            intervalMs={IMAGE_INTERVAL_RIGHT}
            active={heroInView}
          />
        </div>
      </motion.div>

      <Scribbles />

      <section className="hero-copy" id="home" aria-labelledby="hero-title">
        <h1 className="hero-title" id="hero-title">
          <span className="hero-title__mask hero-title__mask--top">
            <motion.span
              className="hero-title__line-motion"
              initial={
                reduceMotion
                  ? false
                  : { y: "-135%", opacity: 0, scale: 0.97 }
              }
              animate={{ y: "0%", opacity: 1, scale: 1 }}
              transition={{ duration: 0.82, delay: reduceMotion ? 0 : 2.86, ease: EASE }}
            >
              <span className="hero-title__top">BIENVENUE</span>
            </motion.span>
          </span>

          <motion.span
            className="hero-title__band"
            initial={
              reduceMotion
                ? false
                : {
                    clipPath: "inset(0 50% 0 50%)",
                    opacity: 0,
                    scale: 0.92,
                  }
            }
            animate={{
              clipPath: "inset(0 0% 0 0%)",
              opacity: 1,
              scale: 1,
            }}
            transition={{ duration: 0.72, delay: reduceMotion ? 0 : 2.94, ease: EASE }}
          >
            <span className="hero-title__band-text">
              <AnimatedWords words={["NOVA", "TERRA"]} delay={reduceMotion ? 0 : 3.10} />
            </span>
          </motion.span>

          <span className="hero-title__mask hero-title__mask--bottom">
            <span className="hero-title__bottom">
              <AnimatedWords words={["LA", "VILLE", "ÉVOLUE"]} delay={reduceMotion ? 0 : 3.18} />
            </span>
          </span>
        </h1>

        <motion.p
          className="hero-subtitle"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, delay: reduceMotion ? 0 : 3.56, ease: EASE }}
        >
          Accédez aux services de la ville, informez-vous, communiquez
          <br />
          et faites remonter vos besoins depuis un même espace.
        </motion.p>
      </section>

      <svg
        className="hero-wave"
        viewBox="0 0 1672 941"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id="hero-wave-copy-safe-zone">
            <rect width="1672" height="941" fill="white" />
            <rect x="505" y="260" width="665" height="430" rx="150" fill="black" />
          </mask>
        </defs>
        <motion.path
          mask="url(#hero-wave-copy-safe-zone)"
          d="M-14 716 C 78 659, 132 637, 179 670 C 216 696, 236 791, 303 791 C 355 791, 397 698, 450 704 C 502 710, 511 757, 555 751 C 620 742, 650 692, 735 700 C 850 710, 932 746, 1040 735 C 1190 720, 1325 674, 1429 647 C 1527 621, 1608 582, 1691 540"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.8, delay: reduceMotion ? 0 : 3.28, ease: "easeInOut" }}
        />
      </svg>

      <motion.a
        className="demo-link"
        href="#fonctionnalites"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: reduceMotion ? 0 : 3.82, ease: EASE }}
        whileHover={reduceMotion ? undefined : { x: 4, scale: 1.025 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        <span>Découvrir</span>
        <Sparkles active={heroInView} />
      </motion.a>

      <motion.a
        className="start-button"
        href="/inscription"
        initial={reduceMotion ? false : { opacity: 0, y: 18, rotate: -2.55 }}
        animate={{ opacity: 1, y: 0, rotate: -2.55 }}
        transition={{ duration: 0.7, delay: reduceMotion ? 0 : 3.75, ease: EASE }}
        whileHover={
          reduceMotion
            ? undefined
            : {
                scale: 1.04,
                rotate: -1.5,
                boxShadow: "0 30px 42px rgba(102, 0, 252, 0.32)",
              }
        }
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        Créer mon espace
      </motion.a>
    </main>
  );
}
