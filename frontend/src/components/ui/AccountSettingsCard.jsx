import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import {
  changePassword,
  requestEmailChange,
  setPassword,
  updateProfile,
} from "../../api/account.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/pages/dashboard.css";

function formText(form, name, fallback = "") {
  const value = form.get(name);
  return typeof value === "string" ? value : fallback;
}

export default function AccountSettingsCard({ allowDelete = false }) {
  const { user, refreshUser, clearSession } = useAuth();
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  function close() {
    if (!busy) setMode(null);
  }

  async function profileSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      await updateProfile({
        first_name: formText(form, "first_name"),
        last_name: formText(form, "last_name"),
        phone_number: formText(form, "phone_number"),
        locale: formText(form, "locale", "fr") || "fr",
      });
      await refreshUser();
      setStatus({ type: "success", message: "Profil mis à jour." });
      setMode(null);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible de modifier le profil.") });
    } finally {
      setBusy(false);
    }
  }

  async function passwordSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      newPassword: formText(form, "new_password"),
      confirmation: formText(form, "confirmation"),
    };
    try {
      const data = user?.has_password
        ? await changePassword({ ...payload, currentPassword: formText(form, "current_password") })
        : await setPassword(payload);
      await refreshUser();
      setStatus({ type: "success", message: data.message });
      setMode(null);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible de modifier le mot de passe.") });
    } finally {
      setBusy(false);
    }
  }

  async function emailSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const data = await requestEmailChange({
        newEmail: formText(form, "new_email"),
        currentPassword: formText(form, "current_password") || "",
      });
      setStatus({ type: "success", message: data.message });
      setMode(null);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible de demander le changement d’e-mail.") });
    } finally {
      setBusy(false);
    }
  }



  return (
    <>
      {status ? <div className={status.type === "error" ? "error-card" : "success-inline"}>{status.message}</div> : null}
      <section className="portal-card">
        <span className="section-label">Mon compte</span>
        <h3>Profil et sécurité</h3>
        <div className="setting-line">
          <div><b>Profil</b><span>{user?.display_name || user?.email}</span></div>
          <button type="button" onClick={() => setMode("profile")}>Modifier</button>
        </div>
        <div className="setting-line">
          <div><b>Adresse e-mail</b><span>{user?.email}</span></div>
          <button type="button" onClick={() => setMode("email")}>Modifier</button>
        </div>
        <div className="setting-line">
          <div><b>Mot de passe</b><span>{user?.has_password ? "Mot de passe local configuré" : "Compte sans mot de passe local"}</span></div>
          <button type="button" onClick={() => setMode("password")}>{user?.has_password ? "Modifier" : "Configurer"}</button>
        </div>
        {allowDelete ? (
          <div className="setting-line setting-line--danger">
            <div><b>Supprimer mon compte</b><span>Cette opération est définitive.</span></div>
            <button type="button" onClick={() => navigate("/citizen/supprimer-compte")}>Supprimer</button>
          </div>
        ) : null}
      </section>

      {mode ? (
        <div className="modal-backdrop" onClick={close}>
          {mode === "profile" ? (
            <form className="portal-modal" onClick={(event) => event.stopPropagation()} onSubmit={profileSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Compte</span><h2>Modifier le profil</h2>
              <div className="form-grid">
                <label><span>Prénom</span><input name="first_name" defaultValue={user?.first_name || ""} /></label>
                <label><span>Nom</span><input name="last_name" defaultValue={user?.last_name || ""} /></label>
              </div>
              <label><span>Téléphone</span><input name="phone_number" defaultValue={user?.phone_number || ""} /></label>
              <label><span>Langue</span><select name="locale" defaultValue={user?.locale || "fr"}><option value="fr">Français</option><option value="en">English</option></select></label>
              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
            </form>
          ) : null}

          {mode === "password" ? (
            <form className="portal-modal" onClick={(event) => event.stopPropagation()} onSubmit={passwordSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Sécurité</span><h2>{user?.has_password ? "Modifier le mot de passe" : "Configurer un mot de passe"}</h2>
              {user?.has_password ? <label><span>Mot de passe actuel</span><input type="password" name="current_password" autoComplete="current-password" required /></label> : null}
              <label><span>Nouveau mot de passe</span><input type="password" name="new_password" autoComplete="new-password" minLength="8" required /></label>
              <label><span>Confirmation</span><input type="password" name="confirmation" autoComplete="new-password" minLength="8" required /></label>
              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Valider"}</button>
            </form>
          ) : null}

          {mode === "email" ? (
            <form className="portal-modal" onClick={(event) => event.stopPropagation()} onSubmit={emailSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Compte</span><h2>Changer d’adresse e-mail</h2>
              <label><span>Nouvelle adresse</span><input type="email" name="new_email" autoComplete="email" required /></label>
              {user?.has_password ? <label><span>Mot de passe actuel</span><input type="password" name="current_password" autoComplete="current-password" required /></label> : null}
              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer la confirmation"}</button>
            </form>
          ) : null}

        </div>
      ) : null}
    </>
  );
}
