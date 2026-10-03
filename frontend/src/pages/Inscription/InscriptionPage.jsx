import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, register, resendVerification, startGoogleAuth } from "../../api/auth.js";
import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../auth.css";

const COPY = {
  fr: {
    back:"Retour à l’accueil", kicker:"ESPACE CITOYEN", title:"Créez votre compte",
    intro:"Votre ville devient plus simple avec Nova Terra.", google:"S’inscrire avec Google",
    redirect:"Redirection…", or:"ou", first:"Prénom", firstPh:"Votre prénom", last:"Nom", lastPh:"Votre nom",
    email:"Adresse e-mail", password:"Mot de passe", passwordPh:"8 caractères minimum",
    confirm:"Confirmation", confirmPh:"Confirmer", accept:"J’accepte les", terms:"conditions d’utilisation",
    and:"et la", privacy:"politique de confidentialité", create:"Créer mon compte", creating:"Création…",
    already:"Déjà un compte ?", login:"Se connecter", visualEyebrow:"BIENVENUE À NOVA TERRA",
    visualTitle:<>Votre ville commence<br/><strong>avec vous.</strong></>,
    visualText:"Créez votre espace citoyen et accédez aux services, démarches et informations de la ville.",
    profile:"Profil citoyen", services:"Services municipaux", requests:"Demandes suivies",
    verifyBack:"Retour", verifyTitle:"Vérifiez votre e-mail", verifyText:"Nous avons envoyé un lien de vérification à",
    verifyNote:"Ouvrez ce lien pour activer votre compte. Vous serez ensuite redirigé vers votre espace Nova Terra.",
    resend:"Renvoyer l’e-mail", resending:"Envoi…", checked:"J’ai déjà vérifié mon e-mail",
    spam:"Pensez à vérifier vos courriers indésirables.", privacyShort:"Confidentialité", termsShort:"Conditions d’utilisation",
    mismatch:"Les mots de passe ne correspondent pas.", registerError:"Inscription impossible.",
    googleError:"Inscription Google impossible.", resendError:"Impossible de renvoyer l’e-mail.",
    created:"Compte créé. Vérifiez maintenant votre e-mail."
  },
  en: {
    back:"Back to home", kicker:"CITIZEN SPACE", title:"Create your account",
    intro:"Your city becomes simpler with Nova Terra.", google:"Sign up with Google",
    redirect:"Redirecting…", or:"or", first:"First name", firstPh:"Your first name", last:"Last name", lastPh:"Your last name",
    email:"Email address", password:"Password", passwordPh:"8 characters minimum",
    confirm:"Confirmation", confirmPh:"Confirm password", accept:"I accept the", terms:"terms of use",
    and:"and the", privacy:"privacy policy", create:"Create my account", creating:"Creating…",
    already:"Already have an account?", login:"Sign in", visualEyebrow:"WELCOME TO NOVA TERRA",
    visualTitle:<>Your city starts<br/><strong>with you.</strong></>,
    visualText:"Create your citizen space and access city services, requests and information.",
    profile:"Citizen profile", services:"City services", requests:"Tracked requests",
    verifyBack:"Back", verifyTitle:"Check your email", verifyText:"We sent a verification link to",
    verifyNote:"Open the link to activate your account. You will then be redirected to your Nova Terra space.",
    resend:"Resend email", resending:"Sending…", checked:"I already verified my email",
    spam:"Remember to check your spam folder.", privacyShort:"Privacy", termsShort:"Terms of use",
    mismatch:"Passwords do not match.", registerError:"Unable to create your account.",
    googleError:"Google sign-up is unavailable.", resendError:"Unable to resend the email.",
    created:"Account created. Check your email now."
  },
  mg: {
    back:"Hiverina amin'ny fandraisana", kicker:"HABAKA MPONINA", title:"Hamorona kaonty",
    intro:"Mora kokoa ny mifandray amin'ny tanàna amin'ny Nova Terra.", google:"Hisoratra amin'ny Google",
    redirect:"Mampifandray…", or:"na", first:"Anarana", firstPh:"Ny anaranao", last:"Fanampin'anarana", lastPh:"Ny fanampin'anaranao",
    email:"Adiresy mailaka", password:"Teny miafina", passwordPh:"Farafahakeliny tarehintsoratra 8",
    confirm:"Fanamafisana", confirmPh:"Avereno ny teny miafina", accept:"Manaiky ny", terms:"fepetra fampiasana",
    and:"sy ny", privacy:"politika momba ny tsiambaratelo", create:"Hamorona ny kaontiko", creating:"Mamorona…",
    already:"Efa manana kaonty?", login:"Hiditra", visualEyebrow:"TONGASOA ETO NOVA TERRA",
    visualTitle:<>Ny tanànanao dia manomboka<br/><strong>aminao.</strong></>,
    visualText:"Mamoròna habaka ho anao ary midira amin'ny sampan-draharaha, fangatahana ary vaovaon'ny tanàna.",
    profile:"Mombamomba ny mponina", services:"Sampan-draharahan'ny tanàna", requests:"Fangatahana arahina",
    verifyBack:"Hiverina", verifyTitle:"Hamarino ny mailakao", verifyText:"Nandefa rohy fanamarinana izahay ho an'ny",
    verifyNote:"Sokafy ilay rohy mba hampavitrika ny kaontinao. Avy eo dia haverina ao amin'ny habakao Nova Terra ianao.",
    resend:"Alefa indray ny mailaka", resending:"Mandefa…", checked:"Efa nanamarina ny mailaka aho",
    spam:"Jereo koa ny lahatahiry spam.", privacyShort:"Tsiambaratelo", termsShort:"Fepetra fampiasana",
    mismatch:"Tsy mitovy ny teny miafina.", registerError:"Tsy afaka mamorona kaonty.",
    googleError:"Tsy afaka misoratra amin'ny Google.", resendError:"Tsy afaka mandefa indray ny mailaka.",
    created:"Vita ny kaonty. Hamarino izao ny mailakao."
  },
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

function EnvelopeIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="5"/><path d="m9 15 15 12 15-12"/></svg>;
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

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6c5.6 0 9 6 9 6a17 17 0 0 1-2.3 3.1M6.2 7.7A15.5 15.5 0 0 0 3 12s3.4 6 9 6a8.8 8.8 0 0 0 3.8-.9M4 4l16 16"/></svg>
  );
}

export default function InscriptionPage() {
  const viewport = useViewportBox();
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [stage, setStage] = useState("account");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");

  const pageStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);

  async function handleAccountSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("passwordConfirm") || "");
    const nextEmail = String(form.get("email") || "");

    if (password !== confirmation) {
      setStatus({ type: "error", message: copy.mismatch });
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
      setStatus({ type: "success", message: data?.message || copy.created });
      setStage("verify");
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, copy.registerError) });
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
      setStatus({ type: "error", message: getApiErrorMessage(error, copy.googleError) });
      setGoogleLoading(false);
    }
  }

  async function resend() {
    if (!email) return;
    setLoading(true);
    try {
      const data = await resendVerification(email);
      setStatus({ type: "success", message: data?.message || copy.resend });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, copy.resendError) });
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || googleLoading;
  const transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

  if (stage === "verify") {
    return (
      <main className="auth-screen auth-screen--register-flow" style={pageStyle}>
        <LanguageSwitcher className="auth-language-switcher" compact />
        <a className="auth-flow-back" href="/inscription" onClick={(event)=>{event.preventDefault();setStage("account")}}>← {copy.verifyBack}</a>
        <a className="auth-flow-brand" href="/" onClick={(event)=>{event.preventDefault();navigate("/")}}>Nova<span>Terra</span></a>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section key="verify" className="auth-centered-card auth-centered-card--verify" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={transition}>
            <div className="auth-step-icon"><EnvelopeIcon /></div>
            <h1>{copy.verifyTitle}</h1>
            <p>{copy.verifyText}<br/><strong>{email}</strong></p>
            <p className="auth-verification-note">{copy.verifyNote}</p>
            {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
            <button className="auth-primary-button" type="button" onClick={resend} disabled={loading}><span>{loading ? copy.resending : copy.resend}</span><span className="auth-button-arrow">→</span></button>
            <button className="auth-secondary-link" type="button" onClick={()=>navigate("/login")}>{copy.checked}</button>
            <small>{copy.spam}</small>
          </motion.section>
        </AnimatePresence>

        <div className="auth-flow-legal"><a href="#confidentialite">{copy.privacyShort}</a><span>•</span><a href="#conditions">{copy.termsShort}</a></div>
      </main>
    );
  }

  return (
    <main className="auth-screen auth-screen--register" style={pageStyle}>
      <div className="auth-split-shell auth-split-shell--reverse">
        <section className="auth-form-panel auth-form-panel--register" aria-labelledby="register-title">
          <LanguageSwitcher className="auth-language-switcher" compact />
          <a className="auth-back" href="/" onClick={(e)=>{e.preventDefault();navigate("/")}}><span>←</span> {copy.back}</a>

          <div className="auth-form-wrap auth-form-wrap--register">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>
            <div className="auth-title-block">
              <span className="auth-mini-kicker">{copy.kicker}</span>
              <h2 id="register-title">{copy.title}</h2>
              <p>{copy.intro}</p>
            </div>

            <form className="auth-modern-form" onSubmit={handleAccountSubmit}>
              <button className="auth-google-modern" type="button" onClick={handleGoogle} disabled={busy}>
                <GoogleIcon />
                <span>{googleLoading ? copy.redirect : copy.google}</span>
              </button>

              <div className="auth-modern-divider" aria-hidden="true"><span>{copy.or}</span></div>

              <div className="auth-grid-two">
                <label className="auth-modern-field"><span>{copy.first}</span><input name="firstName" autoComplete="given-name" placeholder={copy.firstPh} disabled={busy} required /></label>
                <label className="auth-modern-field"><span>{copy.last}</span><input name="lastName" autoComplete="family-name" placeholder={copy.lastPh} disabled={busy} required /></label>
              </div>

              <label className="auth-modern-field"><span>{copy.email}</span><input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" disabled={busy} required /></label>

              <div className="auth-grid-two">
                <label className="auth-modern-field">
                  <span>{copy.password}</span>
                  <div className="auth-input-with-action">
                    <input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" placeholder={copy.passwordPh} minLength="8" disabled={busy} required />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}><EyeIcon open={showPassword}/></button>
                  </div>
                </label>
                <label className="auth-modern-field"><span>{copy.confirm}</span><input type={showPassword ? "text" : "password"} name="passwordConfirm" autoComplete="new-password" placeholder={copy.confirmPh} minLength="8" disabled={busy} required /></label>
              </div>

              <label className="auth-checkbox auth-checkbox--terms"><input type="checkbox" disabled={busy} required/><span>{copy.accept} <a href="#conditions">{copy.terms}</a> {copy.and} <a href="#confidentialite">{copy.privacy}</a>.</span></label>

              <button className="auth-primary-button" type="submit" disabled={busy}><span>{loading ? copy.creating : copy.create}</span><span className="auth-button-arrow">→</span></button>
              {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
            </form>

            <p className="auth-switch-line">{copy.already} <a href="/login" onClick={(e)=>{e.preventDefault();navigate("/login")}}>{copy.login}</a></p>
          </div>

          <div className="auth-legal"><a href="#confidentialite">{copy.privacyShort}</a><span>•</span><a href="#conditions">{copy.termsShort}</a></div>
        </section>

        <aside className="auth-visual auth-visual--register" aria-hidden="true">
          <a className="auth-visual__brand" href="/" tabIndex="-1">Nova<span>Terra</span></a>
          <div className="auth-visual__copy auth-visual__copy--register">
            <p className="auth-visual__eyebrow">{copy.visualEyebrow}</p>
            <h1>{copy.visualTitle}</h1>
            <p>{copy.visualText}</p>
          </div>
          <div className="auth-orbit-scene auth-orbit-scene--register">
            <div className="auth-orbit auth-orbit--one" />
            <div className="auth-orbit auth-orbit--two" />
            <div className="auth-city-core"><span>NT</span><i/><i/><i/></div>
            <article className="auth-float-card auth-float-card--reg-a"><span className="auth-float-card__icon">◎</span><strong>{copy.profile}</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--reg-b"><span className="auth-float-card__icon">⌂</span><strong>{copy.services}</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--reg-c"><span className="auth-float-card__icon">✓</span><strong>{copy.requests}</strong><i/><i/></article>
          </div>
          <div className="auth-visual__line auth-visual__line--register" />
          <span className="auth-visual__spark">✦</span>
        </aside>
      </div>
    </main>
  );
}
