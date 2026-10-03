import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { register } from "../../api/auth.js";
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

function PersonIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="8"/><path d="M10 40c0-8 6-13 14-13s14 5 14 13"/></svg>;
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v10H4V8Z"/><circle cx="12" cy="13" r="3"/></svg>;
}

function StepProgress({ current }) {
  return (
    <div className="register-progress" aria-label={`Étape ${current} sur 2`}>
      <span>Étape {current} sur 2</span>
      <div><i className="is-active"/><i className={current === 2 ? "is-active" : ""}/></div>
    </div>
  );
}

export default function InscriptionPage() {
  const viewport = useViewportBox();
  const [stage, setStage] = useState("account");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState({ firstName: "", lastName: "", gender: "", birthDate: "", profession: "", address: "", phone: "" });
  const [photoName, setPhotoName] = useState("");
  const codeRefs = useRef([]);

  const pageStyle = useMemo(() => ({
    "--auth-screen-w": `${viewport.width}px`,
    "--auth-screen-h": `${viewport.height}px`,
  }), [viewport]);

  function goHome(event) {
    event?.preventDefault();
    navigate("/");
  }

  function goLogin(event) {
    event?.preventDefault();
    navigate("/login");
  }

  function handleAccountSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setEmail(String(form.get("email") || ""));
    setStatus("");
    setStage("verify");
  }

  function handleVerify(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = Array.from({ length: 6 }, (_, index) => form.get(`code-${index}`) || "").join("");
    if (code.length !== 6) {
      setStatus("Saisissez les 6 chiffres du code de vérification.");
      return;
    }
    setStatus("");
    setStage("profile-one");
  }

  function handleCodeInput(event, index) {
    const value = event.currentTarget.value.replace(/\D/g, "").slice(-1);
    event.currentTarget.value = value;
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
  }

  function handleCodeKey(event, index) {
    if (event.key === "Backspace" && !event.currentTarget.value && index > 0) codeRefs.current[index - 1]?.focus();
  }

  function handleProfileOne(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfile((current) => ({
      ...current,
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      gender: String(form.get("gender") || ""),
      birthDate: String(form.get("birthDate") || ""),
    }));
    setStage("profile-two");
  }

  async function finishRegistration(extra = {}) {
    setLoading(true);
    setStatus("");
    try {
      const finalProfile = { ...profile, ...extra };
      await register({ firstName: finalProfile.firstName || "Citoyen", lastName: finalProfile.lastName, email });
      localStorage.setItem("terra_nova_profile", JSON.stringify({ ...finalProfile, email, photoName }));
      navigate("/citizen", { replace: true });
    } catch {
      setStatus("Inscription impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  function handleProfileTwo(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    finishRegistration({
      profession: String(form.get("profession") || ""),
      address: String(form.get("address") || ""),
      phone: String(form.get("phone") || ""),
    });
  }

  const transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

  if (stage !== "account") {
    return (
      <main className="auth-screen auth-screen--register-flow" style={pageStyle}>
        <a className="auth-flow-back" href="/inscription" onClick={(event) => {
          event.preventDefault();
          if (stage === "verify") setStage("account");
          else if (stage === "profile-one") setStage("verify");
          else setStage("profile-one");
        }}>← Retour</a>

        <a className="auth-flow-brand" href="/" onClick={goHome}>Nova<span>Terra</span></a>

        <AnimatePresence mode="wait" initial={false}>
          {stage === "verify" ? (
            <motion.section key="verify" className="auth-centered-card auth-centered-card--verify" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={transition}>
              <div className="auth-step-icon"><EnvelopeIcon /></div>
              <h1>Vérifiez votre e-mail</h1>
              <p>Nous avons envoyé un code à 6 chiffres à<br/><strong>{email || "votre adresse e-mail"}</strong></p>
              <button className="auth-text-button" type="button" onClick={() => setStage("account")}>Modifier l’adresse e-mail</button>

              <form className="verify-form" onSubmit={handleVerify}>
                <label>Code de vérification</label>
                <div className="verify-code-row">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input key={index} ref={(node) => { codeRefs.current[index] = node; }} name={`code-${index}`} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength="1" aria-label={`Chiffre ${index + 1}`} onInput={(event) => handleCodeInput(event, index)} onKeyDown={(event) => handleCodeKey(event, index)} autoFocus={index === 0}/>
                  ))}
                </div>
                <button className="auth-primary-button" type="submit"><span>Vérifier mon e-mail</span><span className="auth-button-arrow">→</span></button>
                {status ? <p className="auth-feedback">{status}</p> : null}
              </form>

              <p className="verify-help">Vous n’avez pas reçu le code ? <button type="button">Renvoyer le code</button></p>
              <small>Pensez à vérifier vos courriers indésirables.</small>
            </motion.section>
          ) : null}

          {stage === "profile-one" ? (
            <motion.section key="profile-one" className="auth-centered-card auth-centered-card--profile" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={transition}>
              <StepProgress current={1} />
              <h1>Votre profil</h1>
              <p>Ces informations sont facultatives.</p>

              <form className="profile-form" onSubmit={handleProfileOne}>
                <label className="profile-photo-picker">
                  <span className="profile-photo-placeholder"><PersonIcon /><i><CameraIcon /></i></span>
                  <span>{photoName || "Ajouter une photo"}</span>
                  <input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || "")} />
                </label>

                <div className="auth-grid-two">
                  <label className="auth-modern-field"><span>Prénom</span><input name="firstName" defaultValue={profile.firstName} placeholder="Votre prénom" /></label>
                  <label className="auth-modern-field"><span>Nom</span><input name="lastName" defaultValue={profile.lastName} placeholder="Votre nom" /></label>
                </div>
                <label className="auth-modern-field"><span>Sexe</span><select name="gender" defaultValue={profile.gender}><option value="">Sélectionner</option><option value="female">Femme</option><option value="male">Homme</option><option value="other">Autre</option><option value="na">Préfère ne pas répondre</option></select></label>
                <label className="auth-modern-field"><span>Date de naissance</span><input type="date" name="birthDate" defaultValue={profile.birthDate} /></label>

                <button className="auth-primary-button" type="submit"><span>Continuer</span><span className="auth-button-arrow">→</span></button>
                <button className="auth-secondary-link" type="button" onClick={() => setStage("profile-two")}>Passer pour le moment</button>
              </form>
            </motion.section>
          ) : null}

          {stage === "profile-two" ? (
            <motion.section key="profile-two" className="auth-centered-card auth-centered-card--profile" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={transition}>
              <StepProgress current={2} />
              <h1>Quelques détails en plus</h1>
              <p>Ces informations sont facultatives.</p>

              <form className="profile-form profile-form--second" onSubmit={handleProfileTwo}>
                <label className="auth-modern-field"><span>Profession</span><input name="profession" defaultValue={profile.profession} placeholder="Votre profession" /></label>
                <label className="auth-modern-field"><span>Adresse</span><input name="address" defaultValue={profile.address} placeholder="Votre adresse à Nova Terra" /></label>
                <label className="auth-modern-field"><span>Numéro de téléphone</span><div className="auth-phone-field"><span>+261</span><input name="phone" defaultValue={profile.phone} placeholder="Votre numéro" inputMode="tel" /></div></label>

                <button className="auth-primary-button" type="submit" disabled={loading}><span>{loading ? "Enregistrement…" : "Enregistrer et terminer"}</span><span className="auth-button-arrow">✓</span></button>
                {status ? <p className="auth-feedback">{status}</p> : null}
                <div className="profile-actions"><button type="button" onClick={() => setStage("profile-one")}>Retour</button><button type="button" onClick={() => finishRegistration()}>Passer pour le moment</button></div>
                <small>Vous pourrez modifier ces informations plus tard.</small>
              </form>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <div className="auth-flow-legal"><a href="#confidentialite">Confidentialité</a><span>•</span><a href="#conditions">Conditions d’utilisation</a></div>
      </main>
    );
  }

  return (
    <main className="auth-screen auth-screen--register" style={pageStyle}>
      <div className="auth-split-shell auth-split-shell--reverse">
        <section className="auth-form-panel auth-form-panel--register" aria-labelledby="register-title">
          <a className="auth-back" href="/" onClick={goHome}><span>←</span> Retour à l’accueil</a>

          <div className="auth-form-wrap auth-form-wrap--register">
            <div className="auth-page-brand auth-page-brand--mobile">Nova<span>Terra</span></div>
            <div className="auth-title-block">
              <span className="auth-mini-kicker">ESPACE CITOYEN</span>
              <h2 id="register-title">Créez votre compte</h2>
              <p>Votre ville devient plus simple avec Nova Terra.</p>
            </div>

            <form className="auth-modern-form" onSubmit={handleAccountSubmit}>
              <label className="auth-modern-field"><span>Adresse e-mail</span><input type="email" name="email" autoComplete="email" defaultValue={email} placeholder="vous@exemple.com" required /></label>
              <label className="auth-modern-field">
                <span>Mot de passe</span>
                <div className="auth-input-with-action">
                  <input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" placeholder="••••••••••••" minLength="8" required />
                  <button type="button" className="auth-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
                  </button>
                </div>
                <small>Au moins 8 caractères.</small>
              </label>

              <label className="auth-checkbox auth-checkbox--terms"><input type="checkbox" required/><span>J’accepte les <a href="#conditions">conditions d’utilisation</a> et la <a href="#confidentialite">politique de confidentialité</a>.</span></label>

              <button className="auth-primary-button" type="submit"><span>Créer mon compte</span><span className="auth-button-arrow">→</span></button>
            </form>

            <p className="auth-switch-line">Déjà un compte ? <a href="/login" onClick={goLogin}>Se connecter</a></p>
          </div>

          <div className="auth-legal"><a href="#confidentialite">Confidentialité</a><span>•</span><a href="#conditions">Conditions d’utilisation</a></div>
        </section>

        <aside className="auth-visual auth-visual--register" aria-hidden="true">
          <a className="auth-visual__brand" href="/" tabIndex="-1">Nova<span>Terra</span></a>

          <div className="auth-visual__copy auth-visual__copy--register">
            <p className="auth-visual__eyebrow">BIENVENUE À NOVA TERRA</p>
            <h1>Votre ville commence<br/><strong>avec vous.</strong></h1>
            <p>Créez votre espace citoyen et accédez aux services qui font vivre la première cité interplanétaire.</p>
          </div>

          <div className="auth-orbit-scene auth-orbit-scene--register">
            <div className="auth-orbit auth-orbit--one" />
            <div className="auth-orbit auth-orbit--two" />
            <div className="auth-city-core"><span>TN</span><i/><i/><i/></div>

            <article className="auth-float-card auth-float-card--reg-a"><span className="auth-float-card__icon">◎</span><strong>Profil citoyen</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--reg-b"><span className="auth-float-card__icon">⌂</span><strong>Services municipaux</strong><i/><i/></article>
            <article className="auth-float-card auth-float-card--reg-c"><span className="auth-float-card__icon">✓</span><strong>Demandes suivies</strong><i/><i/></article>
          </div>

          <div className="auth-visual__line auth-visual__line--register" />
          <span className="auth-visual__spark">✦</span>
        </aside>
      </div>
    </main>
  );
}
