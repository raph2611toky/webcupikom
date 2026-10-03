import { useState } from "react";
import { getApiErrorMessage, register, startGoogleAuth } from "../../api/auth.js";
import "../auth.css";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.44l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.86A6.01 6.01 0 0 1 6.1 12c0-.65.11-1.28.31-1.86V7.52H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.48l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.02c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.52l3.35 2.62C7.2 7.78 9.4 6.02 12 6.02Z" />
    </svg>
  );
}

export default function InscriptionPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState(null);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus(null);

    if (form.password !== form.passwordConfirm) {
      setStatus({ type: "error", message: "Les mots de passe ne correspondent pas." });
      return;
    }

    setLoading(true);
    try {
      const data = await register({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
        password_confirm: form.passwordConfirm,
      });
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Inscription impossible.") });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setStatus(null);
    try {
      await startGoogleAuth({ remember: true });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Inscription Google impossible.") });
      setGoogleLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <main className="auth-page auth-page--register">
      <section className="auth-shell auth-shell--register" aria-labelledby="register-title">
        <a className="auth-brand" href="/" aria-label="Kamo, retour à l’accueil">
          Kam<span>o</span>
        </a>

        <div className="auth-intro">
          <span className="auth-kicker">Créer votre espace</span>
          <h1 id="register-title">Inscription</h1>
          <p>Créez votre compte Kamo.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <button className="auth-google" type="button" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon />
            <span>{googleLoading ? "Redirection…" : "S’inscrire avec Google"}</span>
          </button>

          <div className="auth-divider" aria-hidden="true"><span>ou</span></div>

          <div className="auth-grid">
            <label className="auth-field">
              <span>Prénom</span>
              <input type="text" autoComplete="given-name" placeholder="Votre prénom" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} disabled={busy} required />
            </label>
            <label className="auth-field">
              <span>Nom</span>
              <input type="text" autoComplete="family-name" placeholder="Votre nom" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} disabled={busy} required />
            </label>
          </div>

          <label className="auth-field">
            <span>Adresse e-mail</span>
            <input type="email" autoComplete="email" placeholder="vous@exemple.com" value={form.email} onChange={(e) => update("email", e.target.value)} disabled={busy} required />
          </label>

          <div className="auth-grid">
            <label className="auth-field">
              <span>Mot de passe</span>
              <input type="password" autoComplete="new-password" placeholder="8 caractères minimum" minLength="8" value={form.password} onChange={(e) => update("password", e.target.value)} disabled={busy} required />
            </label>
            <label className="auth-field">
              <span>Confirmation</span>
              <input type="password" autoComplete="new-password" placeholder="Confirmer" minLength="8" value={form.passwordConfirm} onChange={(e) => update("passwordConfirm", e.target.value)} disabled={busy} required />
            </label>
          </div>

          <label className="auth-check auth-check--terms">
            <input type="checkbox" checked={form.terms} onChange={(e) => update("terms", e.target.checked)} disabled={busy} required />
            <span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span>
          </label>

          <button className="auth-submit" type="submit" disabled={busy}>
            {loading ? "Création…" : "Créer mon compte"}
          </button>

          {status ? <p className={`auth-status auth-status--${status.type}`}>{status.message}</p> : null}
        </form>

        <p className="auth-switch">
          Déjà un compte ? <a href="/login">Se connecter</a>
        </p>
      </section>
    </main>
  );
}
