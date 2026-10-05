import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "../../utils/i18n.js";
import "./Footer.css";

const EASE = [0.16, 1, 0.3, 1];

const COPY = {
  fr: {
    desc:"Le point d’accès numérique aux services, informations et besoins de la première ville humaine sur une autre planète.",
    explore:"Explorer", home:"Accueil", services:"Services", news:"Actualités", contact:"Contact",
    space:"Votre espace", login:"Se connecter", register:"Créer un compte",
    people:"Habitants", cityServices:"Services de la ville", council:"Haut Conseil",
    bottom:"Une ville qui évolue au rythme de ses besoins.",
  },
  en: {
    desc:"The digital gateway to services, information and needs in the first human city on another planet.",
    explore:"Explore", home:"Home", services:"Services", news:"News", contact:"Contact",
    space:"Your space", login:"Sign in", register:"Create account",
    people:"Residents", cityServices:"City services", council:"High Council",
    bottom:"A city that evolves with its needs.",
  },
  mg: {
    desc:"Vavahady nomerika mankany amin'ny sampan-draharaha, vaovao ary filàn'ny tanàna olombelona voalohany amin'ny planeta hafa.",
    explore:"Hijery", home:"Fandraisana", services:"Sampan-draharaha", news:"Vaovao", contact:"Fifandraisana",
    space:"Ny habakao", login:"Hiditra", register:"Hamorona kaonty",
    people:"Mponina", cityServices:"Sampan-draharahan'ny tanàna", council:"Filankevitra Ambony",
    bottom:"Tanàna iray izay mivoatra miaraka amin'ny filàny.",
  },
};

const group = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

export default function Footer() {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const reduceMotion = useReducedMotion();

  return (
    <motion.footer
      className="terra-footer"
      id="footer"
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={reduceMotion ? undefined : group}
    >
      <motion.div className="terra-footer__top" variants={reduceMotion ? undefined : group}>
        <motion.div className="terra-footer__brand" variants={reduceMotion ? undefined : item}>
          <a href="/" className="terra-footer__logo" aria-label="Nova Terra, retour en haut">
            Nova<span>Terra</span>
          </a>
          <p>{copy.desc}</p>
        </motion.div>

        <motion.nav
          className="terra-footer__nav"
          aria-label="Navigation de pied de page"
          variants={reduceMotion ? undefined : group}
        >
          <motion.div variants={reduceMotion ? undefined : item}>
            <strong>{copy.explore}</strong>
            <a href="/">{copy.home}</a>
            <a href="/services">{copy.services}</a>
            <a href="/news">{copy.news}</a>
            <a href="/contact">{copy.contact}</a>
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : item}>
            <strong>{copy.space}</strong>
            <a href="/login">{copy.login}</a>
            <a href="/inscription">{copy.register}</a>
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : item}>
            <strong>Nova Terra</strong>
            <span>{copy.people}</span>
            <span>{copy.cityServices}</span>
            <span>{copy.council}</span>
          </motion.div>
        </motion.nav>
      </motion.div>

      <motion.div
        className="terra-footer__bottom"
        variants={reduceMotion ? undefined : item}
      >
        <span>Nova Terra · 24H By Webcup</span>
        <span>{copy.bottom}</span>
      </motion.div>

      <span className="terra-footer__pulse" aria-hidden="true" />
    </motion.footer>
  );
}
