import { useState } from "react";
import {
  getApiErrorMessage,
  isEmailNotVerifiedError,
  resendVerification,
  startGoogleAuth,
} from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getRoleSafeNextPath, navigate } from "../../utils/navigation.js";
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

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [canResend, setCanResend] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setCanResend(false);

    try {
      const data = await login({ email, password, remember });
      navigate(getRoleSafeNextPath(data.user?.role), { replace: true });
    } catch (error) {
      setCanResend(isEmailNotVerifiedError(error));
      setStatus({ type: "error", message: getApiErrorMessage(error, "Connexion impossible.") });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setStatus(null);
    try {
      await startGoogleAuth({ remember });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Connexion Google impossible.") });
      setGoogleLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    try {
      const data = await resendVerification(email);
      setStatus({ type: "success", message: data.message });
      setCanResend(false);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    }
  }

  const busy = loading || googleLoading;

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="login-title">
        <a className="auth-brand" href="/" aria-label="Terra Nova, retour à l’accueil">
          Terra<span>Nova</span>
        </a>

        <div className="auth-intro">
          <span className="auth-kicker">Portail municipal</span>
          <h1 id="login-title">Se connecter</h1>
          <p>Accédez à votre espace Terra Nova.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <button className="auth-google" type="button" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon />
            <span>{googleLoading ? "Redirection…" : "Se connecter avec Google"}</span>
          </button>

          <div className="auth-divider" aria-hidden="true"><span>ou</span></div>

          <label className="auth-field">
            <span>Adresse e-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
            />
          </label>

          <div className="auth-form-row">
            <label className="auth-check">
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={busy}
              />
              <span>Se souvenir de moi</span>
            </label>
            <a href="/mot-de-passe-oublie">Mot de passe oublié ?</a>
          </div>

          <button className="auth-submit" type="submit" disabled={busy}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          {status ? <p className={`auth-status auth-status--${status.type}`}>{status.message}</p> : null}

          {canResend ? (
            <button className="auth-link-button" type="button" onClick={handleResend}>
              Renvoyer l’e-mail de vérification
            </button>
          ) : null}
        </form>

        <p className="auth-switch">
          Pas encore de compte ? <a href="/inscription">Créer un compte</a>
        </p>
      </section>
    </main>
  );
}
