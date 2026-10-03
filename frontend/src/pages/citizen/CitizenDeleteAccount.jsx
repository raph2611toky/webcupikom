import { useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { deleteAccount } from "../../api/account.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const COPY = {
  fr: {
    eyebrow:"Compte", title:"Supprimer mon compte", back:"Retour aux paramètres",
    danger:"ZONE SENSIBLE", heading:"Suppression définitive du compte",
    intro:"Cette action supprimera définitivement votre compte Nova Terra. Une fois confirmée, vous serez déconnecté et l’accès à votre espace ne sera plus possible.",
    step1:"1. Vérifier votre identité", step2:"2. Confirmer la suppression",
    passwordText:"Saisissez votre mot de passe actuel pour confirmer que vous êtes bien à l’origine de cette demande.",
    noPassword:"Ce compte ne possède pas de mot de passe local. Passez directement à la confirmation finale.",
    currentPassword:"Mot de passe actuel", passwordPlaceholder:"Votre mot de passe actuel",
    continue:"Continuer", confirmationText:"Pour éviter une suppression accidentelle, saisissez exactement DELETE dans le champ ci-dessous.",
    confirmation:"Confirmation", delete:"Supprimer définitivement mon compte", deleting:"Suppression…",
    cancel:"Annuler", previous:"Retour", irreversible:"Cette opération est irréversible.",
    deleted:"Compte supprimé.", invalid:"Saisissez exactement DELETE pour confirmer.",
    error:"Impossible de supprimer le compte.",
    security:"Votre mot de passe reste uniquement dans ce formulaire et est envoyé avec la confirmation au moment de la suppression."
  },
  en: {
    eyebrow:"Account", title:"Delete my account", back:"Back to settings",
    danger:"SENSITIVE AREA", heading:"Permanently delete account",
    intro:"This action will permanently delete your Nova Terra account. Once confirmed, you will be signed out and your space will no longer be accessible.",
    step1:"1. Verify your identity", step2:"2. Confirm deletion",
    passwordText:"Enter your current password to confirm that you are the person requesting this deletion.",
    noPassword:"This account does not have a local password. Continue directly to the final confirmation.",
    currentPassword:"Current password", passwordPlaceholder:"Your current password",
    continue:"Continue", confirmationText:"To prevent accidental deletion, type exactly DELETE in the field below.",
    confirmation:"Confirmation", delete:"Permanently delete my account", deleting:"Deleting…",
    cancel:"Cancel", previous:"Back", irreversible:"This action cannot be undone.",
    deleted:"Account deleted.", invalid:"Type exactly DELETE to confirm.",
    error:"Unable to delete the account.",
    security:"Your password stays only in this form and is sent with the final confirmation when the account is deleted."
  },
  mg: {
    eyebrow:"Kaonty", title:"Hamafa ny kaontiko", back:"Hiverina amin'ny fikirana",
    danger:"FARITRA Saro-pady", heading:"Hamafa tanteraka ny kaonty",
    intro:"Ity hetsika ity dia hamafa tanteraka ny kaontinao Nova Terra. Rehefa voamarina dia hivoaka ianao ary tsy ho azo idirana intsony ny habakao.",
    step1:"1. Hamarino ny maha-ianao anao", step2:"2. Hamarino ny famafana",
    passwordText:"Ampidiro ny teny miafinao ankehitriny mba hanamarinana fa ianao no mangataka ny famafana.",
    noPassword:"Tsy manana teny miafina eo an-toerana ity kaonty ity. Afaka miroso mivantana amin'ny fanamafisana farany ianao.",
    currentPassword:"Teny miafina ankehitriny", passwordPlaceholder:"Ny teny miafinao ankehitriny",
    continue:"Hanohy", confirmationText:"Mba hisorohana ny famafana tsy nahy, soraty marina hoe DELETE ao amin'ny saha etsy ambany.",
    confirmation:"Fanamafisana", delete:"Hamafa tanteraka ny kaontiko", deleting:"Mamafa…",
    cancel:"Hanafoana", previous:"Hiverina", irreversible:"Tsy azo averina ity hetsika ity.",
    deleted:"Voafafa ny kaonty.", invalid:"Soraty marina hoe DELETE mba hanamafisana.",
    error:"Tsy afaka mamafa ny kaonty.",
    security:"Mijanona ato amin'ity formulaire ity ihany ny teny miafinao ary alefa miaraka amin'ny fanamafisana rehefa tena mamafa ny kaonty."
  },
};

export default function CitizenDeleteAccount() {
  const { user, clearSession } = useAuth();
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;
  const [step,setStep]=useState(1);
  const [currentPassword,setCurrentPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  function continueToConfirmation(event) {
    event.preventDefault();
    setError("");
    if (user?.has_password && !currentPassword) return;
    setStep(2);
  }

  async function submitDelete(event) {
    event.preventDefault();
    setError("");

    if (confirmation !== "DELETE") {
      setError(copy.invalid);
      return;
    }

    setBusy(true);
    try {
      await deleteAccount({
        currentPassword: user?.has_password ? currentPassword : "",
        confirmation: "DELETE",
      });
      clearSession();
      navigate("/", { replace:true });
    } catch (err) {
      setError(getApiErrorMessage(err, copy.error));
      setBusy(false);
    }
  }

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow={copy.eyebrow} title={copy.title} />
        <main className="portal-content">
          <button className="back-link" type="button" onClick={()=>navigate("/citizen/settings")}>← {copy.back}</button>

          <section className="delete-account-shell">
            <article className="portal-card delete-account-summary">
              <span className="section-label">{copy.danger}</span>
              <h2>{copy.heading}</h2>
              <p>{copy.intro}</p>

              <div className="delete-account-warning">
                <i aria-hidden="true">!</i>
                <div>
                  <b>{copy.irreversible}</b>
                  <span>{user?.email}</span>
                </div>
              </div>

              <ol className="delete-account-steps" aria-label="Étapes de suppression">
                <li className={step===1 ? "is-current" : "is-done"}><i>1</i><span>{copy.step1}</span></li>
                <li className={step===2 ? "is-current" : ""}><i>2</i><span>{copy.step2}</span></li>
              </ol>
            </article>

            <article className="portal-card delete-account-form-card">
              {step===1 ? (
                <form className="delete-account-form" onSubmit={continueToConfirmation}>
                  <span className="section-label">{copy.step1}</span>
                  <h3>{user?.has_password ? copy.currentPassword : copy.step1}</h3>
                  <p className="detail-copy">{user?.has_password ? copy.passwordText : copy.noPassword}</p>

                  {user?.has_password ? (
                    <label>
                      <span>{copy.currentPassword}</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event)=>setCurrentPassword(event.target.value)}
                        placeholder={copy.passwordPlaceholder}
                        required
                      />
                    </label>
                  ) : null}

                  <p className="delete-account-security">{copy.security}</p>

                  <div className="delete-account-actions">
                    <button type="button" className="secondary-action" onClick={()=>navigate("/citizen/settings")}>{copy.cancel}</button>
                    <button className="primary-action" type="submit" disabled={user?.has_password && !currentPassword}>{copy.continue} →</button>
                  </div>
                </form>
              ) : (
                <form className="delete-account-form" onSubmit={submitDelete}>
                  <span className="section-label">{copy.step2}</span>
                  <h3>DELETE</h3>
                  <p className="detail-copy">{copy.confirmationText}</p>

                  <label>
                    <span>{copy.confirmation}</span>
                    <input
                      className="delete-account-confirm-input"
                      value={confirmation}
                      onChange={(event)=>setConfirmation(event.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                      spellCheck="false"
                      required
                    />
                  </label>

                  {error ? <div className="error-card" role="alert">{error}</div> : null}

                  <div className="delete-account-actions">
                    <button type="button" className="secondary-action" disabled={busy} onClick={()=>{setStep(1);setConfirmation("");setError("")}}>{copy.previous}</button>
                    <button className="danger-action delete-account-danger" type="submit" disabled={busy || confirmation!=="DELETE"}>
                      {busy ? copy.deleting : copy.delete}
                    </button>
                  </div>
                </form>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
