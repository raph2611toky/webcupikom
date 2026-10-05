import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1];

export default function AuthJourneyLoader({
  eyebrow = "PORTAIL NOVA TERRA",
  title = "Passage vers la ville",
  message = "Préparation de votre espace citoyen…",
  variant = "default",
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`auth-journey auth-journey--${variant}`}
      role="status"
      aria-live="polite"
      aria-label={`${title}. ${message}`}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      <div className="auth-journey__circuit" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <motion.div
        className="auth-journey__panel"
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
        transition={{ duration: 0.42, ease: EASE }}
      >
        <div className="auth-journey__head">
          <span>{eyebrow}</span>
          <strong>Nova<span>Terra</span></strong>
        </div>

        <div className="auth-journey__viewport" aria-hidden="true">
          <span className="auth-journey__star auth-journey__star--one">✦</span>
          <span className="auth-journey__star auth-journey__star--two">✦</span>
          <span className="auth-journey__star auth-journey__star--three">✦</span>

          <div className="auth-journey__orbit auth-journey__orbit--outer" />
          <div className="auth-journey__orbit auth-journey__orbit--inner" />

          <div className="auth-journey__route">
            <span />
            <span />
            <span />
          </div>

          <div className="auth-journey__traveller">
            <span>NT</span>
          </div>

          <div className="auth-journey__city">
            <span className="auth-journey__tower auth-journey__tower--1" />
            <span className="auth-journey__tower auth-journey__tower--2" />
            <span className="auth-journey__tower auth-journey__tower--3" />
            <span className="auth-journey__tower auth-journey__tower--4" />
            <span className="auth-journey__tower auth-journey__tower--5" />
            <i>NT</i>
          </div>

          <div className="auth-journey__gate">
            <i />
            <i />
          </div>
        </div>

        <div className="auth-journey__copy">
          <span className="auth-journey__step">VISITE VERS LA VILLE</span>
          <h2>{title}</h2>
          <p>{message}</p>
        </div>

        <div className="auth-journey__progress" aria-hidden="true">
          <i />
        </div>
      </motion.div>
    </motion.div>
  );
}
