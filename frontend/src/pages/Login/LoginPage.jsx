import { useState } from "react";
import "../auth.css";

export default function LoginPage() {
  const [status, setStatus] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setStatus("Le formulaire est prêt. Il reste à brancher l’API d’authentification.");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="login-title">
        <a className="auth-brand" href="/" aria-label="Kamo, retour à l’accueil">
          Kam<span>o</span>
        </a>

        <div className="auth-intro">
          <span className="auth-kicker">Bienvenue</span>
          <h1 id="login-title">Se connecter</h1>
          <p>
            Retrouvez vos agents IA, vos automatisations et toutes vos tâches
            depuis votre espace Kamo.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              required
            />
          </label>

          <div className="auth-form-row">
            <label className="auth-check">
              <input type="checkbox" name="remember" />
              <span>Se souvenir de moi</span>
            </label>
            <a href="#mot-de-passe-oublie">Mot de passe oublié ?</a>
          </div>

          <button className="auth-submit" type="submit">
            Se connecter
          </button>

          {status ? <p className="auth-status">{status}</p> : null}
        </form>

        <p className="auth-switch">
          Pas encore de compte ? <a href="/inscription">Créer un compte</a>
        </p>
      </section>
    </main>
  );
}
