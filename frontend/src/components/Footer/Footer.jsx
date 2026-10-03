import "./Footer.css";

export default function Footer() {
  return (
    <footer className="terra-footer" id="contact">
      <div className="terra-footer__top">
        <div className="terra-footer__brand">
          <a href="/" className="terra-footer__logo" aria-label="Nova Terra, retour en haut">
            Nova<span>Terra</span>
          </a>
          <p>Le point d’accès numérique aux services, informations et besoins de la première ville humaine sur une autre planète.</p>
        </div>

        <nav className="terra-footer__nav" aria-label="Navigation de pied de page">
          <div>
            <strong>Explorer</strong>
            <a href="/">Accueil</a>
            <a href="/services">Services</a>
            <a href="/news">Actualités</a>
            <a href="/contact">Contact</a>
          </div>
          <div>
            <strong>Votre espace</strong>
            <a href="/login">Se connecter</a>
            <a href="/inscription">Créer un compte</a>
          </div>
          <div>
            <strong>Nova Terra</strong>
            <span>Habitants</span>
            <span>Services de la ville</span>
            <span>Haut Conseil</span>
          </div>
        </nav>
      </div>

      <div className="terra-footer__bottom">
        <span>Nova Terra · 24H By Webcup</span>
        <span>Une ville qui évolue au rythme de ses besoins.</span>
      </div>
    </footer>
  );
}
