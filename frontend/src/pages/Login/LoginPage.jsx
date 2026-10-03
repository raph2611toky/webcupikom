import { useEffect, useMemo, useState } from "react";
import {
  getApiErrorMessage,
  isEmailNotVerifiedError,
  resendVerification,
  startGoogleAuth,
} from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getRoleSafeNextPath, navigate } from "../../utils/navigation.js";
import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import { useLocale } from "../../utils/i18n.js";
import "../auth.css";

const LOGIN_COPY={
  fr:{visualEyebrow:"PORTAIL CITOYEN · NOVA TERRA",visualTitle:<>La ville,<br/><strong>plus proche de vous.</strong></>,visualText:"Retrouvez vos démarches, vos services et les informations de Nova Terra au même endroit.",back:"Retour à l’accueil",kicker:"ESPACE SÉCURISÉ",title:"Heureux de vous revoir",intro:"Connectez-vous à votre espace Nova Terra.",google:"Continuer avec Google",redirect:"Redirection…",or:"ou",email:"Adresse e-mail",password:"Mot de passe",remember:"Se souvenir de moi",forgot:"Mot de passe oublié ?",login:"Se connecter",loading:"Connexion…",resend:"Renvoyer l’e-mail de vérification",noAccount:"Pas encore de compte ?",register:"Créer un compte",privacy:"Confidentialité",terms:"Conditions d’utilisation",tracked:"Démarches suivies",services:"Services accessibles",alerts:"Alertes reçues"},
  en:{visualEyebrow:"CITIZEN PORTAL · NOVA TERRA",visualTitle:<>The city,<br/><strong>closer to you.</strong></>,visualText:"Find your requests, services and Nova Terra information in one place.",back:"Back to home",kicker:"SECURE SPACE",title:"Welcome back",intro:"Sign in to your Nova Terra space.",google:"Continue with Google",redirect:"Redirecting…",or:"or",email:"Email address",password:"Password",remember:"Remember me",forgot:"Forgot password?",login:"Sign in",loading:"Signing in…",resend:"Resend verification email",noAccount:"No account yet?",register:"Create account",privacy:"Privacy",terms:"Terms of use",tracked:"Tracked requests",services:"Accessible services",alerts:"Alerts received"},
  mg:{visualEyebrow:"HABAKA MPONINA · NOVA TERRA",visualTitle:<>Ny tanàna,<br/><strong>akaiky kokoa anao.</strong></>,visualText:"Tadiavo amin'ny toerana iray ny fangatahanao, ny sampan-draharaha ary ny vaovao ao Nova Terra.",back:"Hiverina amin'ny fandraisana",kicker:"HABAKA VOARO",title:"Faly mahita anao indray",intro:"Midira ao amin'ny habakao Nova Terra.",google:"Hiditra amin'ny Google",redirect:"Mampifandray…",or:"na",email:"Adiresy mailaka",password:"Teny miafina",remember:"Tsarovy aho",forgot:"Hadinonao ny teny miafina?",login:"Hiditra",loading:"Miditra…",resend:"Alefa indray ny mailaka fanamarinana",noAccount:"Tsy mbola manana kaonty?",register:"Hamorona kaonty",privacy:"Tsiambaratelo",terms:"Fepetra fampiasana",tracked:"Fangatahana arahina",services:"Sampan-draharaha azo idirana",alerts:"Fampitandremana voaray"},
};

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
  const viewport = useViewportBox();
  const [locale] = useLocale();
  const copy = LOGIN_COPY[locale] || LOGIN_COPY.fr;
  const { login } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [canResend, setCanResend] = useState(false);

  const shellStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setCanResend(false);
    const form = new FormData(event.currentTarget);
    try {
      const data = await login({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        remember,
      });
      navigate(getRoleSafeNextPath(data.user?.role), { replace: true });
    } catch (error) {
      setCanResend(isEmailNotVerifiedError(error));
      setStatus({ type: "error", message: getApiErrorMessage(error, "Connexion impossible pour le moment.") });
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

  async function resend() {
    if (!email) return;
    try {
      const data = await resendVerification(email);
      setStatus({ type: "success", message: data?.message || "E-mail de vérification renvoyé." });
      setCanResend(false);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible de renvoyer l’e-mail.") });
    }
  }

  const busy = loading || googleLoading;

  return (
    <main className="auth-screen auth-screen--login" style={shellStyle}>
      <div className="auth-split-shell">
        <aside className="auth-visual auth-visual--login" aria-hidden="true">
          <a className="auth-visual__brand" href="/" tabIndex="-1">Nova<span>Terra</span></a>

          <div className="auth-visual__copy">
            <p className="auth-visual__eyebrow">{copy.visualEyebrow}</p>
            <h1>{copy.visualTitle}</h1>
            <p>{copy.visualText}</p>
          </div>

          <div className="auth-orbit-scene">
            <div className="auth-orbit auth-orbit--one" />
            <div className="auth-orbit auth-orbit--two" />
            <div className="auth-planet"><span>NT</span></div>
            <article className="auth-float-card auth-float-card--a"><span className="auth-float-card__icon">✓</span><strong>{copy.tracked}</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--b"><span className="auth-float-card__icon">⌁</span><strong>{copy.services}</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--c"><span className="auth-float-card__icon">!</span><strong>{copy.alerts}</strong><i/><i/></article>
          </div>

          <div className="auth-visual__line" />
          <span className="auth-visual__spark">✦</span>
        </aside>

        <section className="auth-form-panel" aria-labelledby="login-title">
          <LanguageSwitcher className="auth-language-switcher" compact />
          <a className="auth-back" href="/" onClick={(e)=>{e.preventDefault();navigate('/')}}>
            <span>←</span> {copy.back}
          </a>

          <div className="auth-form-wrap">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>
            <div className="auth-title-block">
              <span className="auth-mini-kicker">{copy.kicker}</span>
              <h2 id="login-title">{copy.title}</h2>
              <p>{copy.intro}</p>
            </div>

            <form className="auth-modern-form" onSubmit={handleSubmit}>
              <button className="auth-google-modern" type="button" onClick={handleGoogle} disabled={busy}>
                <GoogleIcon />
                <span>{googleLoading ? copy.redirect : copy.google}</span>
              </button>

              <div className="auth-modern-divider" aria-hidden="true"><span>{copy.or}</span></div>

              <label className="auth-modern-field">
                <span>{copy.email}</span>
                <input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={(e)=>setEmail(e.target.value)} disabled={busy} required />
              </label>

              <label className="auth-modern-field">
                <span>{copy.password}</span>
                <div className="auth-input-with-action">
                  <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" placeholder="••••••••••••" disabled={busy} required />
                  <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>

              <div className="auth-form-meta">
                <label className="auth-checkbox"><input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} disabled={busy}/><span>{copy.remember}</span></label>
                <a href="/mot-de-passe-oublie" onClick={(e)=>{e.preventDefault();navigate('/mot-de-passe-oublie')}}>{copy.forgot}</a>
              </div>

              <button className="auth-primary-button" type="submit" disabled={busy}>
                <span>{loading ? copy.loading : copy.login}</span>
                <span className="auth-button-arrow">→</span>
              </button>

              {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
              {canResend ? <button className="auth-secondary-link" type="button" onClick={resend}>{copy.resend}</button> : null}
            </form>

            <p className="auth-switch-line">{copy.noAccount} <a href="/inscription" onClick={(e)=>{e.preventDefault();navigate('/inscription')}}>{copy.register}</a></p>
          </div>

          <div className="auth-legal"><a href="#confidentialite">{copy.privacy}</a><span>•</span><a href="#conditions">{copy.terms}</a></div>
        </section>
      </div>
    </main>
  );
}
