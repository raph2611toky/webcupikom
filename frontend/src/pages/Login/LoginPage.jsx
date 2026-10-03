import { useEffect, useMemo, useState } from "react";
import { login } from "../../api/auth.js";
import { navigate, roleHome } from "../../utils/navigation.js";
import "../auth.css";

function useViewportBox() {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [viewport, setViewport] = useState(read);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(read()));
    };
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("orientationchange", sync, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return viewport;
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6c5.6 0 9 6 9 6a17 17 0 0 1-2.3 3.1M6.2 7.7A15.5 15.5 0 0 0 3 12s3.4 6 9 6a8.8 8.8 0 0 0 3.8-.9M4 4l16 16"/></svg>
  );
}

export default function LoginPage() {
  const viewport = useViewportBox();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("citizen");

  const shellStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const session = await login({ email: form.get("email"), role });
      const next = new URLSearchParams(window.location.search).get("next");
      navigate(next || roleHome(session.role), { replace: true });
    } catch {
      setStatus("Connexion impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login" style={shellStyle}>
      <div className="auth-split-shell">
        <aside className="auth-visual auth-visual--login" aria-hidden="true">
          <a className="auth-visual__brand" href="/" tabIndex="-1">Nova<span>Terra</span></a>

          <div className="auth-visual__copy">
            <p className="auth-visual__eyebrow">PORTAIL CITOYEN · NOVA TERRA</p>
            <h1>La ville,<br/><strong>plus proche de vous.</strong></h1>
            <p>Retrouvez vos démarches, vos services et les informations de Nova Terra au même endroit.</p>
          </div>

          <div className="auth-orbit-scene">
            <div className="auth-orbit auth-orbit--one" />
            <div className="auth-orbit auth-orbit--two" />
            <div className="auth-planet"><span>TN</span></div>

            <article className="auth-float-card auth-float-card--a">
              <span className="auth-float-card__icon">✓</span>
              <strong>Démarches suivies</strong>
              <i/><i/>
            </article>
            <article className="auth-float-card auth-float-card--b">
              <span className="auth-float-card__icon">⌁</span>
              <strong>Services accessibles</strong>
              <i/><i/>
            </article>
            <article className="auth-float-card auth-float-card--c">
              <span className="auth-float-card__icon">!</span>
              <strong>Alertes reçues</strong>
              <i/><i/>
            </article>
          </div>

          <div className="auth-visual__line" />
          <span className="auth-visual__spark">✦</span>
        </aside>

        <section className="auth-form-panel" aria-labelledby="login-title">
          <a className="auth-back" href="/" onClick={(e)=>{e.preventDefault();navigate('/')}}>
            <span>←</span> Retour à l’accueil
          </a>

          <div className="auth-form-wrap">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>
            <div className="auth-title-block">
              <span className="auth-mini-kicker">ESPACE SÉCURISÉ</span>
              <h2 id="login-title">Heureux de vous revoir</h2>
              <p>Connectez-vous à votre espace Nova Terra.</p>
            </div>

            <form className="auth-modern-form" onSubmit={handleSubmit}>
              <label className="auth-modern-field">
                <span>Adresse e-mail</span>
                <input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" required />
              </label>

              <label className="auth-modern-field">
                <span>Mot de passe</span>
                <div className="auth-input-with-action">
                  <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" placeholder="••••••••••••" required />
                  <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>

              <fieldset className="auth-role-choice">
                <legend>Accès de démonstration</legend>
                <div>
                  {[
                    ["citizen", "Citoyen"],
                    ["agent", "Agent"],
                    ["admin", "Admin"],
                  ].map(([value, label]) => (
                    <button key={value} type="button" className={role === value ? "is-active" : ""} onClick={() => setRole(value)}>{label}</button>
                  ))}
                </div>
              </fieldset>

              <div className="auth-form-meta">
                <label className="auth-checkbox"><input type="checkbox" name="remember"/><span>Se souvenir de moi</span></label>
                <a href="#mot-de-passe-oublie">Mot de passe oublié ?</a>
              </div>

              <button className="auth-primary-button" type="submit" disabled={loading}>
                <span>{loading ? "Connexion…" : "Se connecter"}</span>
                <span className="auth-button-arrow">→</span>
              </button>

              {status ? <p className="auth-feedback">{status}</p> : null}
            </form>

            <p className="auth-switch-line">Pas encore de compte ? <a href="/inscription" onClick={(e)=>{e.preventDefault();navigate('/inscription')}}>Créer un compte</a></p>
          </div>

          <div className="auth-legal"><a href="#confidentialite">Confidentialité</a><span>•</span><a href="#conditions">Conditions d’utilisation</a></div>
        </section>
      </div>
    </main>
  );
}
