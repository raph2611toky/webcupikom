import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  clearPendingMfa,
  getApiErrorMessage,
  getPendingMfa,
  isEmailNotVerifiedError,
  resendVerification,
  sendAuthMfaEmail,
  startGoogleAuth,
} from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getRoleSafeNextPath, navigate } from "../../utils/navigation.js";
import { navigateAuth } from "../../utils/authTransition.js";
import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import HumanCheckCaptcha from "../../components/auth/HumanCheckCaptcha.jsx";
import AuthJourneyLoader from "../../components/auth/AuthJourneyLoader.jsx";
import novaTerraCity from "../../assets/auth/nova-terra-city.png";
import { useLocale } from "../../utils/i18n.js";
import "../auth.css";

const LOGIN_COPY={
  fr:{visualEyebrow:"PORTAIL CITOYEN · NOVA TERRA",visualTitle:<>La ville,<br/><strong>plus proche de vous.</strong></>,visualText:"Retrouvez vos démarches, vos services et les informations de Nova Terra au même endroit.",back:"Retour à l’accueil",kicker:"ESPACE SÉCURISÉ",title:"Heureux de vous revoir",intro:"Connectez-vous à votre espace Nova Terra.",google:"Continuer avec Google",redirect:"Redirection…",or:"ou",email:"Adresse e-mail",password:"Mot de passe",remember:"Se souvenir de moi",forgot:"Mot de passe oublié ?",login:"Se connecter",loading:"Connexion…",resend:"Renvoyer l’e-mail de vérification",noAccount:"Pas encore de compte ?",register:"Créer un compte",privacy:"Confidentialité",terms:"Conditions d’utilisation",tracked:"Démarches suivies",trackedDesc:"Retrouvez vos dossiers et leur progression.",services:"Services accessibles",servicesDesc:"Accédez rapidement aux services de la ville.",alerts:"Alertes reçues",alertsDesc:"Restez informé des événements qui vous concernent.",mfaKicker:"DOUBLE VÉRIFICATION",mfaTitle:"Confirmez votre identité",mfaIntro:"Votre compte utilise une vérification en deux étapes. Choisissez une méthode puis saisissez votre code.",authenticator:"Application d’authentification",emailCode:"Code par e-mail",recovery:"Code de récupération",mfaCode:"Code à 6 chiffres",recoveryCode:"Code de récupération",sendCode:"Envoyer le code",sendingCode:"Envoi…",verify:"Vérifier et continuer",verifying:"Vérification…",backLogin:"Revenir à la connexion",codeSent:"Un code de vérification a été envoyé par e-mail.",captchaRequired:"Validez la vérification de sécurité avant de vous connecter.",successTitle:"Bienvenue à Nova Terra",successText:"Ouverture de votre espace citoyen…",loginJourney:"Connexion au portail",loginJourneyText:"Vérification de votre accès et préparation du passage vers la ville.",googleJourney:"Passage par Google",googleJourneyText:"Connexion sécurisée à Google avant votre arrivée à Nova Terra.",mfaJourney:"Validation de votre identité",mfaJourneyText:"Dernière vérification avant l’ouverture de la ville."},
  en:{visualEyebrow:"CITIZEN PORTAL · NOVA TERRA",visualTitle:<>The city,<br/><strong>closer to you.</strong></>,visualText:"Find your requests, services and Nova Terra information in one place.",back:"Back to home",kicker:"SECURE SPACE",title:"Welcome back",intro:"Sign in to your Nova Terra space.",google:"Continue with Google",redirect:"Redirecting…",or:"or",email:"Email address",password:"Password",remember:"Remember me",forgot:"Forgot password?",login:"Sign in",loading:"Signing in…",resend:"Resend verification email",noAccount:"No account yet?",register:"Create account",privacy:"Privacy",terms:"Terms of use",tracked:"Tracked requests",trackedDesc:"Find your requests and follow their progress.",services:"Accessible services",servicesDesc:"Quickly access the city services you need.",alerts:"Alerts received",alertsDesc:"Stay informed about events that matter to you.",mfaKicker:"TWO-STEP VERIFICATION",mfaTitle:"Confirm your identity",mfaIntro:"Your account uses two-step verification. Choose a method and enter your code.",authenticator:"Authenticator app",emailCode:"Email code",recovery:"Recovery code",mfaCode:"6-digit code",recoveryCode:"Recovery code",sendCode:"Send code",sendingCode:"Sending…",verify:"Verify and continue",verifying:"Verifying…",backLogin:"Back to sign in",codeSent:"A verification code was sent by email.",captchaRequired:"Complete the security check before signing in.",successTitle:"Welcome to Nova Terra",successText:"Opening your citizen space…",loginJourney:"Connecting to the portal",loginJourneyText:"Checking your access and preparing your passage to the city.",googleJourney:"Passing through Google",googleJourneyText:"Secure Google sign-in before your arrival in Nova Terra.",mfaJourney:"Confirming your identity",mfaJourneyText:"One last verification before opening the city."},
  mg:{visualEyebrow:"HABAKA MPONINA · NOVA TERRA",visualTitle:<>Ny tanàna,<br/><strong>akaiky kokoa anao.</strong></>,visualText:"Tadiavo amin'ny toerana iray ny fangatahanao, ny sampan-draharaha ary ny vaovao ao Nova Terra.",back:"Hiverina amin'ny fandraisana",kicker:"HABAKA VOARO",title:"Faly mahita anao indray",intro:"Midira ao amin'ny habakao Nova Terra.",google:"Hiditra amin'ny Google",redirect:"Mampifandray…",or:"na",email:"Adiresy mailaka",password:"Teny miafina",remember:"Tsarovy aho",forgot:"Hadinonao ny teny miafina?",login:"Hiditra",loading:"Miditra…",resend:"Alefa indray ny mailaka fanamarinana",noAccount:"Tsy mbola manana kaonty?",register:"Hamorona kaonty",privacy:"Tsiambaratelo",terms:"Fepetra fampiasana",tracked:"Fangatahana arahina",trackedDesc:"Tadiavo sy araho ny fivoaran’ny fangatahanao.",services:"Sampan-draharaha azo idirana",servicesDesc:"Midira haingana amin’ny sampan-draharahan’ny tanàna.",alerts:"Fampitandremana voaray",alertsDesc:"Mahazoa vaovao momba ireo zava-mitranga manan-danja.",mfaKicker:"FANAMARINANA ROA",mfaTitle:"Hamarino fa ianao marina",mfaIntro:"Mampiasa fanamarinana roa dingana ny kaontinao. Safidio ny fomba ary ampidiro ny kaody.",authenticator:"Application authenticator",emailCode:"Kaody amin’ny mailaka",recovery:"Kaody fanarenana",mfaCode:"Kaody 6 isa",recoveryCode:"Kaody fanarenana",sendCode:"Handefa kaody",sendingCode:"Mandefa…",verify:"Hanamarina sy hanohy",verifying:"Manamarina…",backLogin:"Hiverina amin’ny fidirana",codeSent:"Nalefa tamin’ny mailaka ny kaody fanamarinana.",captchaRequired:"Ataovy aloha ny fanamarinana fiarovana vao miditra.",successTitle:"Tongasoa eto Nova Terra",successText:"Manokatra ny habakao ho an’ny mponina…",loginJourney:"Mifandray amin’ny vavahady",loginJourneyText:"Manamarina ny fidiranao sy manomana ny lalana mankany an-tanàna.",googleJourney:"Mandalo amin’i Google",googleJourneyText:"Fidirana Google azo antoka alohan’ny hahatongavana ao Nova Terra.",mfaJourney:"Manamarina ny maha-ianao anao",mfaJourneyText:"Fanamarinana farany alohan’ny hanokafana ny tanàna."},
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

function MailFieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>;
}

function LockFieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1.2"/></svg>;
}

function normalizedMethods(context) {
  return (context?.methods || []).map((value) => String(value).toLowerCase());
}

function defaultMfaMode(context) {
  const methods = normalizedMethods(context);
  if (methods.some((value) => value.includes("totp") || value.includes("authenticator") || value.includes("mfa"))) return "authenticator";
  if (methods.some((value) => value.includes("email"))) return "email";
  if (methods.some((value) => value.includes("recover"))) return "recovery";
  return "authenticator";
}

export default function LoginPage() {
  const viewport = useViewportBox();
  const [locale] = useLocale();
  const copy = LOGIN_COPY[locale] || LOGIN_COPY.fr;
  const { login, verifyMfa } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [mfa, setMfa] = useState(() => getPendingMfa());
  const [mfaMode, setMfaMode] = useState(() => defaultMfaMode(getPendingMfa()));
  const [mfaCode, setMfaCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEmailLoading, setMfaEmailLoading] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);
  const [successLoading, setSuccessLoading] = useState(false);

  const shellStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);

  const methods = useMemo(() => normalizedMethods(mfa), [mfa]);
  const allowAuthenticator = !methods.length || methods.some((value) => value.includes("totp") || value.includes("authenticator") || value.includes("mfa"));
  const allowEmail = !methods.length || methods.some((value) => value.includes("email"));
  const allowRecovery = !methods.length || methods.some((value) => value.includes("recover"));

  useEffect(() => {
    if (!mfa && new URLSearchParams(window.location.search).get("mfa") === "1") {
      setStatus({ type: "error", message: "Le challenge MFA a expiré. Reconnectez-vous." });
    }
  }, [mfa]);

  async function finishAuthentication(role) {
    setSuccessLoading(true);
    // Laisse le temps au loader de rendre une transition visible, sans ralentir le traitement réseau.
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    navigate(getRoleSafeNextPath(role), { replace: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!captchaValid) {
      setStatus({ type: "error", message: copy.captchaRequired });
      return;
    }
    setLoading(true);
    setStatus(null);
    setCanResend(false);
    const form = new FormData(event.currentTarget);
    try {
      const data = await login({
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || ""),
        remember,
      });
      if (data?.mfa_required) {
        const pending = getPendingMfa() || {
          mfa_token: data.mfa_token,
          methods: data.methods || [],
          expires_in: data.expires_in,
        };
        setMfa(pending);
        setMfaMode(defaultMfaMode(pending));
        setMfaCode("");
        setEmailChallengeId("");
        setStatus(null);
        return;
      }
      await finishAuthentication(data.user?.role);
    } catch (error) {
      setCanResend(isEmailNotVerifiedError(error));
      setStatus({ type: "error", message: getApiErrorMessage(error, "Connexion impossible pour le moment.") });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!captchaValid) {
      setStatus({ type: "error", message: copy.captchaRequired });
      return;
    }
    setGoogleLoading(true);
    setStatus(null);
    try {
      const next = new URLSearchParams(window.location.search).get("next") || "";
      await startGoogleAuth({ remember, returnTo: next.startsWith("/") && !next.startsWith("//") ? next : "" });
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

  async function sendMfaEmail() {
    if (!mfa?.mfa_token) return;
    setMfaEmailLoading(true);
    setStatus(null);
    try {
      const data = await sendAuthMfaEmail(mfa.mfa_token);
      setEmailChallengeId(data?.email_challenge_id || "");
      setMfaCode("");
      setStatus({ type: "success", message: data?.message || copy.codeSent });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible d’envoyer le code MFA.") });
    } finally {
      setMfaEmailLoading(false);
    }
  }

  async function handleMfaSubmit(event) {
    event.preventDefault();
    if (!mfa?.mfa_token || !mfaCode.trim()) return;
    if (mfaMode === "email" && !emailChallengeId) {
      setStatus({ type: "error", message: "Envoyez d’abord le code par e-mail." });
      return;
    }

    setMfaLoading(true);
    setStatus(null);
    try {
      const payload = { mfa_token: mfa.mfa_token };
      if (mfaMode === "authenticator") payload.mfa_code = mfaCode.trim();
      if (mfaMode === "recovery") payload.recovery_code = mfaCode.trim();
      if (mfaMode === "email") {
        payload.email_code = mfaCode.trim();
        payload.email_challenge_id = emailChallengeId;
      }
      const data = await verifyMfa(payload);
      setMfa(null);
      await finishAuthentication(data.user?.role);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Code invalide ou expiré.") });
    } finally {
      setMfaLoading(false);
    }
  }

  function resetMfa() {
    clearPendingMfa();
    setMfa(null);
    setMfaCode("");
    setEmailChallengeId("");
    setStatus(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("mfa");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  const busy = loading || googleLoading || mfaLoading || mfaEmailLoading || successLoading;

  const journey = successLoading
    ? { variant: "success", title: copy.successTitle, message: copy.successText }
    : mfaLoading
      ? { variant: "verify", title: copy.mfaJourney, message: copy.mfaJourneyText }
      : loading
        ? { variant: "login", title: copy.loginJourney, message: copy.loginJourneyText }
        : null;

  return (
    <main className="auth-screen auth-screen--login" style={shellStyle}>
      <div className="auth-split-shell">
        <aside className="auth-visual auth-visual--login" aria-hidden="true">
          <img className="auth-visual__city-background" src={novaTerraCity} alt="" />
          <div className="auth-visual__city-overlay" />

          <a className="auth-visual__brand" href="/" tabIndex="-1">
            Nova<span>Terra</span>
          </a>

          <div className="auth-visual__copy auth-visual__copy--login">
            <p className="auth-visual__eyebrow">{copy.visualEyebrow}</p>
            <h1>{copy.visualTitle}</h1>
            <p>{copy.visualText}</p>
          </div>

          <div className="auth-orbit-scene auth-orbit-scene--login">
            <div className="auth-orbit auth-orbit--one" />
            <div className="auth-orbit auth-orbit--two" />

            <div className="auth-city-core">
              <span>NT</span>
              <i />
              <i />
              <i />
            </div>

            <article className="auth-float-card auth-float-card--login-a">
              <span className="auth-float-card__icon">✓</span>
              <strong>{copy.tracked}</strong>
              <p>{copy.trackedDesc}</p>
            </article>

            <article className="auth-float-card auth-float-card--login-b">
              <span className="auth-float-card__icon">⌂</span>
              <strong>{copy.services}</strong>
              <p>{copy.servicesDesc}</p>
            </article>

            <article className="auth-float-card auth-float-card--login-c">
              <span className="auth-float-card__icon">!</span>
              <strong>{copy.alerts}</strong>
              <p>{copy.alertsDesc}</p>
            </article>
          </div>

          <div className="auth-visual__line auth-visual__line--login" />
          <span className="auth-visual__spark">✦</span>
        </aside>

        <section className="auth-form-panel auth-form-panel--login" aria-labelledby="login-title">
          <LanguageSwitcher className="auth-language-switcher" compact />
          <a className="auth-back" href="/" onClick={(event)=>{event.preventDefault();navigate('/')}}>
            <span>←</span> {copy.back}
          </a>

          <nav className="auth-legal auth-legal--top" aria-label="Informations légales">
            <a href="#confidentialite">{copy.privacy}</a>
            <span aria-hidden="true">•</span>
            <a href="#conditions">{copy.terms}</a>
          </nav>

          <div className="auth-form-wrap">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>

            {mfa ? <>
              <div className="auth-title-block auth-title-block--mfa auth-reveal-block">
                <span className="auth-mini-kicker">{copy.mfaKicker}</span>
                <h2 id="login-title">{copy.mfaTitle}</h2>
                <p>{copy.mfaIntro}</p>
              </div>

              <form className="auth-modern-form auth-mfa-form auth-reveal-form" onSubmit={handleMfaSubmit}>
                <div className="auth-mfa-methods" role="group" aria-label="Méthode de vérification">
                  {allowAuthenticator ? <button type="button" className={mfaMode==="authenticator"?"is-active":""} aria-pressed={mfaMode==="authenticator"} onClick={()=>{setMfaMode("authenticator");setMfaCode("");setStatus(null)}}>◉ <span>{copy.authenticator}</span></button> : null}
                  {allowEmail ? <button type="button" className={mfaMode==="email"?"is-active":""} aria-pressed={mfaMode==="email"} onClick={()=>{setMfaMode("email");setMfaCode("");setStatus(null)}}>✉ <span>{copy.emailCode}</span></button> : null}
                  {allowRecovery ? <button type="button" className={mfaMode==="recovery"?"is-active":""} aria-pressed={mfaMode==="recovery"} onClick={()=>{setMfaMode("recovery");setMfaCode("");setStatus(null)}}>⌘ <span>{copy.recovery}</span></button> : null}
                </div>

                {mfaMode === "email" && !emailChallengeId ? <button className="auth-google-modern auth-mfa-send" type="button" disabled={busy} onClick={sendMfaEmail}>
                  <span>{mfaEmailLoading ? copy.sendingCode : copy.sendCode}</span>
                </button> : null}

                <label className="auth-modern-field">
                  <span>{mfaMode === "recovery" ? copy.recoveryCode : copy.mfaCode}</span>
                  <input
                    type="text"
                    inputMode={mfaMode === "recovery" ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(event)=>setMfaCode(event.target.value)}
                    placeholder={mfaMode === "recovery" ? "XXXX-XXXX-XXXX" : "000000"}
                    maxLength={mfaMode === "recovery" ? 64 : 6}
                    disabled={busy || (mfaMode === "email" && !emailChallengeId)}
                    required
                  />
                </label>

                <button className="auth-primary-button" type="submit" disabled={busy || !mfaCode.trim() || (mfaMode === "email" && !emailChallengeId)}>
                  <span>{mfaLoading ? copy.verifying : copy.verify}</span>
                  <span className="auth-button-arrow">→</span>
                </button>

                {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
                <button className="auth-secondary-link" type="button" onClick={resetMfa}>{copy.backLogin}</button>
              </form>
            </> : <>
              <div className="auth-title-block auth-reveal-block">
                <span className="auth-mini-kicker">{copy.kicker}</span>
                <h2 id="login-title">{copy.title}</h2>
                <p>{copy.intro}</p>
              </div>

              <form className="auth-modern-form auth-reveal-form" onSubmit={handleSubmit}>
                <HumanCheckCaptcha locale={locale} disabled={busy} onValidChange={setCaptchaValid} />

                <button className="auth-google-modern" type="button" onClick={handleGoogle} disabled={busy || !captchaValid} aria-disabled={busy || !captchaValid}>
                  <GoogleIcon />
                  <span>{googleLoading ? copy.redirect : copy.google}</span>
                </button>

                <div className="auth-modern-divider" aria-hidden="true"><span>{copy.or}</span></div>

                <label className="auth-modern-field">
                  <span>{copy.email}</span>
                  <div className="auth-field-control">
                    <span className="auth-field-control__icon"><MailFieldIcon /></span>
                    <input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={(event)=>setEmail(event.target.value)} disabled={busy} required />
                  </div>
                </label>

                <label className="auth-modern-field">
                  <span>{copy.password}</span>
                  <div className="auth-input-with-action">
                    <span className="auth-field-control__icon"><LockFieldIcon /></span>
                    <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" placeholder="••••••••••••" disabled={busy} required />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </label>

                <div className="auth-form-meta">
                  <label className="auth-checkbox"><input type="checkbox" checked={remember} onChange={(event)=>setRemember(event.target.checked)} disabled={busy}/><span>{copy.remember}</span></label>
                  <a href="/mot-de-passe-oublie" onClick={(event)=>{event.preventDefault();navigate('/mot-de-passe-oublie')}}>{copy.forgot}</a>
                </div>

                <button className="auth-primary-button" type="submit" disabled={busy || !captchaValid}>
                  <span>{loading ? copy.loading : copy.login}</span>
                  <span className="auth-button-arrow">→</span>
                </button>

                {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
                {canResend ? <button className="auth-secondary-link" type="button" onClick={resend}>{copy.resend}</button> : null}
              </form>

              <p className="auth-switch-line">{copy.noAccount} <a href="/inscription" onClick={(event)=>{event.preventDefault();navigateAuth("/inscription")}}>{copy.register}</a></p>
            </>}
          </div>

        </section>
      </div>

      <AnimatePresence>
        {journey ? (
          <AuthJourneyLoader
            variant={journey.variant}
            title={journey.title}
            message={journey.message}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
