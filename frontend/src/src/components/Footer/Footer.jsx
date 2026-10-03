import { useLocale } from "../../utils/i18n.js";
import "./Footer.css";

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

export default function Footer() {
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;

  return (
    <footer className="terra-footer" id="contact">
      <div className="terra-footer__top">
        <div className="terra-footer__brand">
          <a href="/" className="terra-footer__logo" aria-label="Nova Terra, retour en haut">
            Nova<span>Terra</span>
          </a>
          <p>{copy.desc}</p>
        </div>

        <nav className="terra-footer__nav" aria-label="Navigation de pied de page">
          <div>
            <strong>{copy.explore}</strong>
            <a href="/">{copy.home}</a>
            <a href="/services">{copy.services}</a>
            <a href="/news">{copy.news}</a>
            <a href="/contact">{copy.contact}</a>
          </div>
          <div>
            <strong>{copy.space}</strong>
            <a href="/login">{copy.login}</a>
            <a href="/inscription">{copy.register}</a>
          </div>
          <div>
            <strong>Nova Terra</strong>
            <span>{copy.people}</span>
            <span>{copy.cityServices}</span>
            <span>{copy.council}</span>
          </div>
        </nav>
      </div>

      <div className="terra-footer__bottom">
        <span>Nova Terra · 24H By Webcup</span>
        <span>{copy.bottom}</span>
      </div>
    </footer>
  );
}
