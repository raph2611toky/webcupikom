import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, register, resendVerification } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
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

function EnvelopeIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="5"/><path d="m9 15 15 12 15-12"/></svg>;
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6c5.6 0 9 6 9 6a17 17 0 0 1-2.3 3.1M6.2 7.7A15.5 15.5 0 0 0 3 12s3.4 6 9 6a8.8 8.8 0 0 0 3.8-.9M4 4l16 16"/></svg>
  );
}

export default function InscriptionPage() {
  const viewport = useViewportBox();
  const [stage, setStage] = useState("account");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const pageStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);

  async function submitAccount(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("passwordConfirm") || "");
    const nextEmail = String(form.get("email") || "");

    if (password !== confirmation) {
      setStatus({ type: "error", message: "Les mots de passe ne correspondent pas." });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const data = await register({
        first_name: String(form.get("firstName") || ""),
        last_name: String(form.get("lastName") || ""),
        email: nextEmail,
        password,
        password_confirm: confirmation,
      });
      setEmail(nextEmail);
      setStatus({ type: "success", message: data?.message || "Compte créé. Vérifiez votre e-mail." });
      setStage("verify");
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Inscription impossible.") });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email) return;
    setLoading(true);
    try {
      const data = await resendVerification(email);
      setStatus({ type: "success", message: data?.message || "E-mail de vérification renvoyé." });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible de renvoyer l’e-mail.") });
    } finally {
      setLoading(false);
    }
  }

  const transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

  if (stage === "verify") {
    return (
      <main className="auth-screen auth-screen--register-flow" style={pageStyle}>
        <a className="auth-flow-back" href="/inscription" onClick={(e)=>{e.preventDefault();setStage("account")}}>← Retour à l’inscription</a>
        <a className="auth-flow-brand" href="/" onClick={(e)=>{e.preventDefault();navigate("/")}}>Nova<span>Terra</span></a>

        <AnimatePresence mode="wait">
          <motion.section key="verify" className="auth-centered-card auth-centered-card--verify" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={transition}>
            <div className="auth-step-icon"><EnvelopeIcon /></div>
            <h1>Vérifiez votre e-mail</h1>
            <p>Nous avons envoyé un lien de vérification à<br/><strong>{email}</strong></p>
            <p className="auth-verification-note">Ouvrez ce lien pour activer votre compte. Vous serez ensuite connecté à votre espace Nova Terra.</p>
            {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
            <button className="auth-primary-button" type="button" onClick={resend} disabled={loading}><span>{loading ? "Envoi…" : "Renvoyer l’e-mail"}</span><span className="auth-button-arrow">→</span></button>
            <button className="auth-secondary-link" type="button" onClick={()=>navigate("/login")}>J’ai déjà vérifié mon e-mail</button>
            <small>Pensez à vérifier vos courriers indésirables.</small>
          </motion.section>
        </AnimatePresence>

        <div className="auth-flow-legal"><a href="#confidentialite">Confidentialité</a><span>•</span><a href="#conditions">Conditions d’utilisation</a></div>
      </main>
    );
  }

  return (
    <main className="auth-screen auth-screen--register" style={pageStyle}>
      <div className="auth-split-shell auth-split-shell--reverse">
        <section className="auth-form-panel auth-form-panel--register" aria-labelledby="register-title">
          <a className="auth-back" href="/" onClick={(e)=>{e.preventDefault();navigate("/")}}><span>←</span> Retour à l’accueil</a>

          <div className="auth-form-wrap auth-form-wrap--register">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>
            <div className="auth-title-block">
              <span className="auth-mini-kicker">NOUVEL HABITANT</span>
              <h2 id="register-title">Créez votre compte</h2>
              <p>Votre espace personnel pour les services municipaux de Nova Terra.</p>
            </div>

            <form className="auth-modern-form" onSubmit={submitAccount}>
              <div className="auth-grid-two">
                <label className="auth-modern-field"><span>Prénom</span><input name="firstName" autoComplete="given-name" placeholder="Votre prénom" required /></label>
                <label className="auth-modern-field"><span>Nom</span><input name="lastName" autoComplete="family-name" placeholder="Votre nom" required /></label>
              </div>

              <label className="auth-modern-field"><span>Adresse e-mail</span><input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" required /></label>

              <label className="auth-modern-field">
                <span>Mot de passe</span>
                <div className="auth-input-with-action">
                  <input type={showPassword ? "text" : "password"} name="password" minLength="8" autoComplete="new-password" placeholder="8 caractères minimum" required />
                  <button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}><EyeIcon open={showPassword}/></button>
                </div>
              </label>

              <label className="auth-modern-field"><span>Confirmer le mot de passe</span><input type={showPassword ? "text" : "password"} name="passwordConfirm" minLength="8" autoComplete="new-password" placeholder="Confirmer votre mot de passe" required /></label>

              <label className="auth-checkbox auth-checkbox--terms"><input type="checkbox" required/><span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span></label>

              <button className="auth-primary-button" type="submit" disabled={loading}><span>{loading ? "Création…" : "Créer mon compte"}</span><span className="auth-button-arrow">→</span></button>
              {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
            </form>

            <p className="auth-switch-line">Déjà un compte ? <a href="/login" onClick={(e)=>{e.preventDefault();navigate('/login')}}>Se connecter</a></p>
          </div>

          <div className="auth-legal"><a href="#confidentialite">Confidentialité</a><span>•</span><a href="#conditions">Conditions d’utilisation</a></div>
        </section>

        <aside className="auth-visual auth-visual--register" aria-hidden="true">
          <a className="auth-visual__brand" href="/" tabIndex="-1">Nova<span>Terra</span></a>
          <div className="auth-visual__copy">
            <p className="auth-visual__eyebrow">BIENVENUE À NOVA TERRA</p>
            <h1>Votre ville,<br/><strong>votre espace.</strong></h1>
            <p>Créez votre compte et accédez aux services, démarches et informations de la ville.</p>
          </div>
          <div className="auth-orbit-scene auth-orbit-scene--register">
            <div className="auth-orbit auth-orbit--one" />
            <div className="auth-orbit auth-orbit--two" />
            <div className="auth-planet"><span>NT</span></div>
            <article className="auth-float-card auth-float-card--a"><span className="auth-float-card__icon">✓</span><strong>Profil citoyen</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--b"><span className="auth-float-card__icon">◇</span><strong>Services municipaux</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--c"><span className="auth-float-card__icon">◎</span><strong>Démarches suivies</strong><i/><i/></article>
          </div>
          <div className="auth-visual__line" />
          <span className="auth-visual__spark">✦</span>
        </aside>
      </div>
    </main>
  );
}
