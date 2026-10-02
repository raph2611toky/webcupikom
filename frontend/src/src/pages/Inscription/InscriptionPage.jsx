import { useState } from "react";
import "../auth.css";

export default function InscriptionPage() {
  const [status, setStatus] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setStatus("Le formulaire est prêt. Il reste à brancher l’API d’inscription.");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--register" aria-labelledby="register-title">
        <a className="auth-brand" href="/" aria-label="Kamo, retour à l’accueil">
          Kam<span>o</span>
        </a>

        <div className="auth-intro">
          <span className="auth-kicker">Créer votre espace</span>
          <h1 id="register-title">Inscription</h1>
          <p>
            Créez votre compte Kamo et commencez à déléguer progressivement
            votre quotidien à vos agents IA.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-grid">
            <label className="auth-field">
              <span>Prénom</span>
              <input
                type="text"
                name="firstName"
                autoComplete="given-name"
                placeholder="Votre prénom"
                required
              />
            </label>

            <label className="auth-field">
              <span>Nom</span>
              <input
                type="text"
                name="lastName"
                autoComplete="family-name"
                placeholder="Votre nom"
                required
              />
            </label>
          </div>

          <label className="auth-field">
            <span>Adresse e-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>Mot de passe</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              minLength="8"
              required
            />
          </label>

          <label className="auth-check auth-check--terms">
            <input type="checkbox" name="terms" required />
            <span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span>
          </label>

          <button className="auth-submit" type="submit">
            Créer mon compte
          </button>

          {status ? <p className="auth-status">{status}</p> : null}
        </form>

        <p className="auth-switch">
          Déjà un compte ? <a href="/login">Se connecter</a>
        </p>
      </section>
    </main>
  );
}
