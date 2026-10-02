import { useEffect, useId, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import "./Hero.css";
import CoreEffect from "./CoreEffect.jsx";

import heroList from "../../assets/hero/hero-list.png";
import heroPhone from "../../assets/hero/hero-phone.png";
import heroPlanning from "../../assets/hero/hero-planning.png";
import heroTravel from "../../assets/hero/hero-travel.png";
import hero1 from "../../assets/hero/hero-1.png";
import hero2 from "../../assets/hero/hero-2.png";
import hero3 from "../../assets/hero/hero-3.png";
import hero4 from "../../assets/hero/hero-4.png";

// Keep each side coherent, but avoid repeating the same visual every second.
const LEFT_IMAGES = [heroList, heroPlanning, hero2, heroTravel];
const RIGHT_IMAGES = [heroPhone, hero1, hero3, hero4];
const IMAGE_INTERVAL_LEFT = 7200;
const IMAGE_INTERVAL_RIGHT = 8800;
const EASE = [0.16, 1, 0.3, 1];

function RotatingImage({ className, images, start = 0, alt = "", intervalMs = 5600 }) {
  const [index, setIndex] = useState(start);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % images.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [images, intervalMs]);

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
              : { opacity: 0, scale: 1.012, filter: "blur(5px)" }
          }
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={
            reduceMotion
              ? undefined
              : { opacity: 0, scale: 0.995, filter: "blur(4px)" }
          }
          transition={{ duration: 0.66, ease: EASE }}
        />
      </AnimatePresence>
    </div>
  );
}

function OrbitText() {
  const id = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();

  return (
    <motion.svg
      className="kamo-orbit"
      viewBox="0 0 230 230"
      aria-hidden="true"
      initial={{ rotate: -12 }}
      animate={{ rotate: reduceMotion ? -12 : 348 }}
      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
      transition={
        reduceMotion
          ? { duration: 0 }
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
          KAMO · AGENTS IA · ALLÉGEZ VOTRE QUOTIDIEN · KAMO ·
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

function Sparkles() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className="demo-sparkles"
      aria-hidden="true"
      animate={
        reduceMotion
          ? undefined
          : { rotate: [0, 8, -4, 0], scale: [1, 1.08, 1, 1] }
      }
      transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 0.7 }}
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

  return (
    <main className="kamo-hero">
      <motion.div
        className="kamo-hero__glow kamo-hero__glow--tl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 22, -8, 0], y: [0, 12, 4, 0], scale: [1, 1.08, 1.03, 1] }
        }
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="kamo-hero__glow kamo-hero__glow--right"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -18, 5, 0], y: [0, 16, -4, 0], scale: [1, 1.05, 1.1, 1] }
        }
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="kamo-hero__glow kamo-hero__glow--br"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -20, 8, 0], y: [0, -12, 5, 0], scale: [1, 1.08, 1.02, 1] }
        }
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <CoreEffect />

      <motion.header
        className="kamo-header"
        initial={reduceMotion ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
      >
        <nav className="kamo-nav" aria-label="Navigation principale">
          <a href="#home">Home</a>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#cas">Cas d’usage</a>
          <a href="#contact">Contact</a>
        </nav>

        <a className="kamo-logo" href="#home" aria-label="Kamo, accueil">
          Kam<span>o</span>
        </a>

        <a className="kamo-login" href="#login">
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
          alt="Tâches quotidiennes gérées par Kamo"
          intervalMs={IMAGE_INTERVAL_LEFT}
        />
      </motion.div>

      <motion.div
        className="hero-top-right-motion"
        initial={reduceMotion ? false : { opacity: 0, x: 45, y: -20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 1.0, delay: reduceMotion ? 0 : 3.58, ease: EASE }}
      >
        <div className="hero-top-right" aria-hidden="true">
          <OrbitText />
          <RotatingImage
            className="hero-photo hero-photo--right"
            images={RIGHT_IMAGES}
            start={1}
            alt="Utilisatrice de Kamo"
            intervalMs={IMAGE_INTERVAL_RIGHT}
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
                  : { y: "-135%", opacity: 0, scale: 0.97, filter: "blur(10px)" }
              }
              animate={{ y: "0%", opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.82, delay: reduceMotion ? 0 : 2.86, ease: EASE }}
            >
              <span className="hero-title__top">DÉLÉGUEZ</span>
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
                    filter: "blur(8px)",
                  }
            }
            animate={{
              clipPath: "inset(0 0% 0 0%)",
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
            }}
            transition={{ duration: 0.72, delay: reduceMotion ? 0 : 2.94, ease: EASE }}
          >
            <span className="hero-title__band-text">
              <AnimatedWords words={["VOTRE", "QUOTIDIEN"]} delay={reduceMotion ? 0 : 3.10} />
            </span>
          </motion.span>

          <span className="hero-title__mask hero-title__mask--bottom">
            <span className="hero-title__bottom">
              <AnimatedWords words={["À", "DES", "AGENTS", "IA"]} delay={reduceMotion ? 0 : 3.18} />
            </span>
          </span>
        </h1>

        <motion.p
          className="hero-subtitle"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, delay: reduceMotion ? 0 : 3.56, ease: EASE }}
        >
          La plateforme qui permet de déléguer sa vie quotidienne
          <br />
          à des agents IA autonomes.
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
        href="#demo"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: reduceMotion ? 0 : 3.82, ease: EASE }}
        whileHover={reduceMotion ? undefined : { x: 4, scale: 1.025 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        <span>Voir démo</span>
        <Sparkles />
      </motion.a>

      <motion.a
        className="start-button"
        href="#start"
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
        Commencer
      </motion.a>
    </main>
  );
}
