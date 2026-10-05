import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, register, resendVerification, startGoogleAuth } from "../../api/auth.js";
import LanguageSwitcher from "../../components/ui/LanguageSwitcher.jsx";
import HumanCheckCaptcha from "../../components/auth/HumanCheckCaptcha.jsx";
import AuthJourneyLoader from "../../components/auth/AuthJourneyLoader.jsx";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import { navigateAuth } from "../../utils/authTransition.js";
import novaTerraCity from "../../assets/auth/nova-terra-city.png";
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
    profile:"Profil citoyen", profileDesc:"Gérez vos informations en toute simplicité.", services:"Services municipaux", servicesDesc:"Accédez à tous les services de votre ville.", requests:"Demandes suivies", requestsDesc:"Suivez l’avancement de vos démarches.",
    verifyBack:"Retour", verifyTitle:"Vérifiez votre e-mail", verifyText:"Nous avons envoyé un lien de vérification à",
    verifyNote:"Ouvrez ce lien pour activer votre compte. Après validation, vous pourrez compléter votre profil maintenant ou passer cette étape.",
    resend:"Renvoyer l’e-mail", resending:"Envoi…", checked:"J’ai déjà vérifié mon e-mail",
    spam:"Pensez à vérifier vos courriers indésirables.", privacyShort:"Confidentialité", termsShort:"Conditions d’utilisation",
    mismatch:"Les mots de passe ne correspondent pas.", registerError:"Inscription impossible.",
    googleError:"Inscription Google impossible.", resendError:"Impossible de renvoyer l’e-mail.",
    created:"Compte créé. Vérifiez maintenant votre e-mail.", captchaRequired:"Validez la vérification de sécurité avant de créer votre compte.",
    weakPassword:"Ce mot de passe est trop faible. Utilisez au moins 8 caractères et mélangez au moins 3 types : minuscules, majuscules, chiffres et caractères spéciaux.",
    passwordStrength:"Sécurité", weak:"Faible", fair:"Correct", strong:"Fort",
    passwordHint:"8 caractères minimum et au moins 3 types de caractères.",
    createJourney:"Création de votre accès", createJourneyText:"Votre identité citoyenne prend place dans Nova Terra.", googleJourney:"Passage par Google", googleJourneyText:"Connexion sécurisée avant votre arrivée dans la ville.", resendJourney:"Transmission du signal", resendJourneyText:"Nous renvoyons votre lien de vérification vers votre adresse e-mail."
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
    profile:"Citizen profile", profileDesc:"Manage your information with ease.", services:"City services", servicesDesc:"Access all your city services.", requests:"Tracked requests", requestsDesc:"Follow the progress of your requests.",
    verifyBack:"Back", verifyTitle:"Check your email", verifyText:"We sent a verification link to",
    verifyNote:"Open the link to activate your account. After verification, you can complete your profile now or skip that step.",
    resend:"Resend email", resending:"Sending…", checked:"I already verified my email",
    spam:"Remember to check your spam folder.", privacyShort:"Privacy", termsShort:"Terms of use",
    mismatch:"Passwords do not match.", registerError:"Unable to create your account.",
    googleError:"Google sign-up is unavailable.", resendError:"Unable to resend the email.",
    created:"Account created. Check your email now.", captchaRequired:"Complete the security check before creating your account.",
    weakPassword:"This password is too weak. Use at least 8 characters and combine at least 3 types: lowercase, uppercase, numbers and special characters.",
    passwordStrength:"Security", weak:"Weak", fair:"Good", strong:"Strong",
    passwordHint:"At least 8 characters and at least 3 character types.",
    createJourney:"Creating your access", createJourneyText:"Your citizen identity is taking its place in Nova Terra.", googleJourney:"Passing through Google", googleJourneyText:"Secure sign-in before your arrival in the city.", resendJourney:"Sending the signal", resendJourneyText:"We are sending a new verification link to your email address."
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
    profile:"Mombamomba ny mponina", profileDesc:"Tantano mora ny mombamomba anao.", services:"Sampan-draharahan'ny tanàna", servicesDesc:"Midira amin'ny tolotra rehetra ao an-tanàna.", requests:"Fangatahana arahina", requestsDesc:"Araho ny fivoaran'ny fangatahanao.",
    verifyBack:"Hiverina", verifyTitle:"Hamarino ny mailakao", verifyText:"Nandefa rohy fanamarinana izahay ho an'ny",
    verifyNote:"Sokafy ilay rohy mba hampavitrika ny kaontinao. Rehefa voamarina dia afaka mameno ny mombamomba anao ianao na mandalo aloha.",
    resend:"Alefa indray ny mailaka", resending:"Mandefa…", checked:"Efa nanamarina ny mailaka aho",
    spam:"Jereo koa ny lahatahiry spam.", privacyShort:"Tsiambaratelo", termsShort:"Fepetra fampiasana",
    mismatch:"Tsy mitovy ny teny miafina.", registerError:"Tsy afaka mamorona kaonty.",
    googleError:"Tsy afaka misoratra amin'ny Google.", resendError:"Tsy afaka mandefa indray ny mailaka.",
    created:"Vita ny kaonty. Hamarino izao ny mailakao.", captchaRequired:"Ataovy aloha ny fanamarinana fiarovana vao mamorona kaonty.",
    weakPassword:"Malemy loatra ity teny miafina ity. Mampiasà tarehintsoratra 8 farafahakeliny ary afangaro karazana 3: litera kely, litera lehibe, isa ary marika manokana.",
    passwordStrength:"Fiarovana", weak:"Malemy", fair:"Mety", strong:"Matanjaka",
    passwordHint:"Tarehintsoratra 8 farafahakeliny ary karazana tarehintsoratra 3 farafahakeliny.",
    createJourney:"Mamorona ny fidiranao", createJourneyText:"Mametraka ny mombamomba anao ao Nova Terra izahay.", googleJourney:"Mandalo amin’i Google", googleJourneyText:"Fidirana azo antoka alohan’ny hahatongavana ao an-tanàna.", resendJourney:"Mandefa famantarana", resendJourneyText:"Mandefa rohy fanamarinana vaovao amin’ny mailakao izahay."
  },
};


function evaluatePassword(password = "") {
  const categories = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const categoryCount = categories.filter(Boolean).length;
  const hasMinimumLength = password.length >= 8;
  const isAcceptable = hasMinimumLength && categoryCount >= 3;
  const score = Number(hasMinimumLength) + categoryCount + Number(password.length >= 12);
  const level = !isAcceptable ? "weak" : score >= 5 ? "strong" : "fair";
  return { categoryCount, hasMinimumLength, isAcceptable, level };
}

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

function UserFieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5.6 19c.7-3.7 3.1-5.7 6.4-5.7s5.7 2 6.4 5.7"/></svg>;
}

function MailFieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>;
}

function LockFieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1.2"/></svg>;
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
  const [passwordValue, setPasswordValue] = useState("");
  const [email, setEmail] = useState("");
  const [captchaValid, setCaptchaValid] = useState(false);

  const pageStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);
  const passwordStrength = useMemo(() => evaluatePassword(passwordValue), [passwordValue]);

  async function handleAccountSubmit(event) {
    event.preventDefault();
    if (!captchaValid) {
      setStatus({ type: "error", message: copy.captchaRequired });
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("passwordConfirm") || "");
    const nextEmail = String(form.get("email") || "");

    if (!evaluatePassword(password).isAcceptable) {
      setStatus({ type: "error", message: copy.weakPassword });
      return;
    }

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
    if (!captchaValid) {
      setStatus({ type: "error", message: copy.captchaRequired });
      return;
    }
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

  const journey = googleLoading
    ? { variant: "google", title: copy.googleJourney, message: copy.googleJourneyText }
    : loading
      ? stage === "verify"
        ? { variant: "verify", title: copy.resendJourney, message: copy.resendJourneyText }
        : { variant: "register", title: copy.createJourney, message: copy.createJourneyText }
      : null;

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
            <button className="auth-secondary-link" type="button" onClick={()=>navigateAuth("/login")}>{copy.checked}</button>
            <small>{copy.spam}</small>
          </motion.section>
        </AnimatePresence>

        <div className="auth-flow-legal"><a href="#confidentialite">{copy.privacyShort}</a><span>•</span><a href="#conditions">{copy.termsShort}</a></div>

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

  return (
    <main className="auth-screen auth-screen--register" style={pageStyle}>
      <div className="auth-split-shell auth-split-shell--reverse">
        <section className="auth-form-panel auth-form-panel--register" aria-labelledby="register-title">
          <LanguageSwitcher className="auth-language-switcher" compact />
          <a className="auth-back" href="/" onClick={(e)=>{e.preventDefault();navigate("/")}}><span>←</span> {copy.back}</a>

          <nav className="auth-legal auth-legal--top" aria-label="Informations légales">
            <a href="#confidentialite">{copy.privacyShort}</a>
            <span aria-hidden="true">•</span>
            <a href="#conditions">{copy.termsShort}</a>
          </nav>

          <div className="auth-form-wrap auth-form-wrap--register">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>
            <div className="auth-title-block auth-reveal-block">
              <span className="auth-mini-kicker">{copy.kicker}</span>
              <h2 id="register-title">{copy.title}</h2>
              <p>{copy.intro}</p>
            </div>

            <form className="auth-modern-form auth-reveal-form" onSubmit={handleAccountSubmit}>
              <HumanCheckCaptcha locale={locale} disabled={busy} onValidChange={setCaptchaValid} />

              <button className="auth-google-modern" type="button" onClick={handleGoogle} disabled={busy || !captchaValid} aria-disabled={busy || !captchaValid}>
                <GoogleIcon />
                <span>{googleLoading ? copy.redirect : copy.google}</span>
              </button>

              <div className="auth-modern-divider" aria-hidden="true"><span>{copy.or}</span></div>

              <div className="auth-grid-two">
                <label className="auth-modern-field">
                  <span>{copy.first}</span>
                  <div className="auth-field-control">
                    <span className="auth-field-control__icon"><UserFieldIcon /></span>
                    <input name="firstName" autoComplete="given-name" placeholder={copy.firstPh} disabled={busy} required />
                  </div>
                </label>
                <label className="auth-modern-field">
                  <span>{copy.last}</span>
                  <div className="auth-field-control">
                    <span className="auth-field-control__icon"><UserFieldIcon /></span>
                    <input name="lastName" autoComplete="family-name" placeholder={copy.lastPh} disabled={busy} required />
                  </div>
                </label>
              </div>

              <label className="auth-modern-field">
                <span>{copy.email}</span>
                <div className="auth-field-control">
                  <span className="auth-field-control__icon"><MailFieldIcon /></span>
                  <input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" disabled={busy} required />
                </div>
              </label>

              <div className="auth-grid-two">
                <label className="auth-modern-field">
                  <span>{copy.password}</span>
                  <div className="auth-input-with-action">
                    <span className="auth-field-control__icon"><LockFieldIcon /></span>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      placeholder={copy.passwordPh}
                      minLength="8"
                      value={passwordValue}
                      onChange={(event) => setPasswordValue(event.target.value)}
                      aria-describedby="register-password-strength register-password-hint"
                      aria-invalid={passwordValue.length > 0 && !passwordStrength.isAcceptable}
                      disabled={busy}
                      required
                    />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}><EyeIcon open={showPassword}/></button>
                  </div>
                  <div className={`auth-password-strength is-${passwordStrength.level}`} id="register-password-strength" aria-live="polite">
                    <span>{copy.passwordStrength}</span>
                    <div className="auth-password-strength__bars" aria-hidden="true"><i/><i/><i/></div>
                    <strong>{copy[passwordStrength.level]}</strong>
                  </div>
                  <small id="register-password-hint">{copy.passwordHint}</small>
                </label>
                <label className="auth-modern-field">
                  <span>{copy.confirm}</span>
                  <div className="auth-input-with-action">
                    <span className="auth-field-control__icon"><LockFieldIcon /></span>
                    <input type={showPassword ? "text" : "password"} name="passwordConfirm" autoComplete="new-password" placeholder={copy.confirmPh} minLength="8" disabled={busy} required />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}><EyeIcon open={showPassword}/></button>
                  </div>
                </label>
              </div>

              <label className="auth-checkbox auth-checkbox--terms"><input type="checkbox" disabled={busy} required/><span>{copy.accept} <a href="#conditions">{copy.terms}</a> {copy.and} <a href="#confidentialite">{copy.privacy}</a>.</span></label>

              <button className="auth-primary-button" type="submit" disabled={busy || !captchaValid || !passwordStrength.isAcceptable}><span>{loading ? copy.creating : copy.create}</span><span className="auth-button-arrow">→</span></button>
              {status ? <p className={`auth-feedback auth-feedback--${status.type}`} role={status.type==="error" ? "alert" : "status"} aria-live="polite">{status.message}</p> : null}
            </form>

            <p className="auth-switch-line">{copy.already} <a href="/login" onClick={(e)=>{e.preventDefault();navigateAuth("/login")}}>{copy.login}</a></p>
          </div>

        </section>

        <aside className="auth-visual auth-visual--register" aria-hidden="true">
          <img className="auth-visual__city-background" src={novaTerraCity} alt="" />
          <div className="auth-visual__city-overlay" />
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

            <article className="auth-float-card auth-float-card--reg-a">
              <span className="auth-float-card__icon">◎</span>
              <strong>{copy.profile}</strong>
              <p>{copy.profileDesc}</p>
            </article>

            <article className="auth-float-card auth-float-card--reg-b">
              <span className="auth-float-card__icon">⌂</span>
              <strong>{copy.services}</strong>
              <p>{copy.servicesDesc}</p>
            </article>

            <article className="auth-float-card auth-float-card--reg-c">
              <span className="auth-float-card__icon">✓</span>
              <strong>{copy.requests}</strong>
              <p>{copy.requestsDesc}</p>
            </article>
          </div>

          <div className="auth-visual__line auth-visual__line--register" />
          <span className="auth-visual__spark">✦</span>
        </aside>
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
