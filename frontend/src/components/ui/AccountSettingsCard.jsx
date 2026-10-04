import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import {
  changePassword,
  confirmMfa,
  disableMfa,
  getMfaStatus,
  regenerateMfaRecoveryCodes,
  requestEmailChange,
  setPassword,
  setupMfa,
  updateProfile,
} from "../../api/account.js";
import {
  clearAccountGoogleProof,
  getAccountGoogleProof,
  getApiErrorMessage,
  startGoogleAuth,
} from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";

function formText(form, name, fallback = "") {
  const value = form.get(name);
  return typeof value === "string" ? value : fallback;
}

function verificationPayload(form) {
  const method = formText(form, "verification_method", "mfa");
  const value = formText(form, "verification_code").trim();
  if (method === "recovery") return { recovery_code: value };
  return { mfa_code: value };
}

export default function AccountSettingsCard({ allowDelete = false }) {
  const { user, refreshUser, clearSession } = useAuth();
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [mfa, setMfa] = useState({
    loading: true,
    enabled: false,
    confirmed_at: null,
    recovery_codes_remaining: 0,
    authenticator: "",
    methods: [],
  });
  const [setupData, setSetupData] = useState(null);
  const [recoveryData, setRecoveryData] = useState(null);
  const [googleProof, setGoogleProof] = useState(() => getAccountGoogleProof());

  async function refreshMfa() {
    try {
      const data = await getMfaStatus();
      setMfa({ loading: false, ...data });
    } catch (error) {
      setMfa((current) => ({ ...current, loading: false }));
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de charger l’état du MFA."),
      });
    }
  }

  useEffect(() => {
    refreshMfa();
  }, []);

  useEffect(() => {
    const proof = getAccountGoogleProof();
    if (!proof) return;

    setGoogleProof(proof);

    if (proof.purpose === "mfa-setup") {
      setBusy(true);
      setStatus(null);
      setupMfa({ code: proof.code, state: proof.state })
        .then((data) => {
          setSetupData(data);
          setMode("mfa-confirm");
          clearAccountGoogleProof();
          setGoogleProof(null);
        })
        .catch((error) => {
          clearAccountGoogleProof();
          setGoogleProof(null);
          setStatus({
            type: "error",
            message: getApiErrorMessage(error, "Impossible de préparer l’activation du MFA."),
          });
        })
        .finally(() => setBusy(false));
      return;
    }

    if (proof.purpose === "mfa-disable") setMode("mfa-disable");
    if (proof.purpose === "mfa-recovery") setMode("mfa-regenerate");
    if (proof.purpose === "set-password") setMode("password");
    if (proof.purpose === "change-email") setMode("email");
  }, []);

  function close() {
    if (busy) return;
    if (["mfa-disable", "mfa-regenerate", "password", "email"].includes(mode) && googleProof) {
      clearAccountGoogleProof();
      setGoogleProof(null);
    }
    setMode(null);
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
    const mfaVerification = mfa.enabled ? verificationPayload(form) : {};
    try {
      let data;
      if (user?.has_password) {
        data = await changePassword({
          newPassword: formText(form, "new_password"),
          confirmation: formText(form, "confirmation"),
          currentPassword: formText(form, "current_password"),
          ...mfaVerification,
        });
      } else {
        if (googleProof?.purpose !== "set-password") {
          throw new Error("La vérification Google n’est plus disponible. Recommencez l’opération.");
        }
        data = await setPassword({
          newPassword: formText(form, "new_password"),
          confirmation: formText(form, "confirmation"),
          code: googleProof.code,
          state: googleProof.state,
          ...mfaVerification,
        });
      }
      clearAccountGoogleProof();
      setGoogleProof(null);
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
    const mfaVerification = mfa.enabled ? verificationPayload(form) : {};
    try {
      const identity = user?.has_password
        ? { currentPassword: formText(form, "current_password") || "" }
        : googleProof?.purpose === "change-email"
          ? { code: googleProof.code, state: googleProof.state }
          : {};

      if (!user?.has_password && !identity.code) {
        throw new Error("La vérification Google n’est plus disponible. Recommencez l’opération.");
      }

      const data = await requestEmailChange({
        newEmail: formText(form, "new_email"),
        ...identity,
        ...mfaVerification,
      });
      clearAccountGoogleProof();
      setGoogleProof(null);
      setStatus({ type: "success", message: data.message });
      setMode(null);
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Impossible de demander le changement d’e-mail.") });
    } finally {
      setBusy(false);
    }
  }

  async function beginAccountSensitiveAction(purpose, targetMode) {
    setStatus(null);
    if (user?.has_password) {
      setMode(targetMode);
      return;
    }

    setBusy(true);
    try {
      await startGoogleAuth({
        purpose,
        returnTo: "/citizen/settings",
      });
    } catch (error) {
      setBusy(false);
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de lancer la vérification Google."),
      });
    }
  }

  async function beginMfaSetup() {
    setStatus(null);
    if (user?.has_password) {
      setMode("mfa-setup-auth");
      return;
    }

    setBusy(true);
    try {
      await startGoogleAuth({
        purpose: "mfa-setup",
        returnTo: "/citizen/settings",
      });
    } catch (error) {
      setBusy(false);
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de lancer la vérification Google."),
      });
    }
  }

  async function setupMfaSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const data = await setupMfa({
        current_password: formText(form, "current_password"),
      });
      setSetupData(data);
      setMode("mfa-confirm");
    } catch (error) {
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de préparer l’activation du MFA."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmMfaSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const data = await confirmMfa(formText(form, "code"));
      setRecoveryData({
        codes: Array.isArray(data.recovery_codes) ? data.recovery_codes : [],
        requiresRelogin: Boolean(data.requires_relogin),
        message: data.message || "MFA activé.",
      });
      await refreshMfa();
      setMode("mfa-codes");
      setSetupData(null);
    } catch (error) {
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Code incorrect ou expiré."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function beginMfaSensitiveAction(purpose, localMode) {
    setStatus(null);
    if (user?.has_password) {
      setMode(localMode);
      return;
    }

    setBusy(true);
    try {
      await startGoogleAuth({
        purpose,
        returnTo: "/citizen/settings",
      });
    } catch (error) {
      setBusy(false);
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de lancer la vérification Google."),
      });
    }
  }

  function sensitiveIdentityPayload(form, purpose) {
    const payload = { ...verificationPayload(form) };
    if (user?.has_password) {
      payload.current_password = formText(form, "current_password");
    } else if (googleProof?.purpose === purpose) {
      payload.code = googleProof.code;
      payload.state = googleProof.state;
    }
    return payload;
  }

  async function disableMfaSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const data = await disableMfa(sensitiveIdentityPayload(form, "mfa-disable"));
      clearAccountGoogleProof();
      setGoogleProof(null);
      setMode(null);
      setStatus({ type: "success", message: data.message || "MFA désactivé." });
      await refreshMfa();
    } catch (error) {
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de désactiver le MFA."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodesSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const data = await regenerateMfaRecoveryCodes(
        sensitiveIdentityPayload(form, "mfa-recovery"),
      );
      clearAccountGoogleProof();
      setGoogleProof(null);
      setRecoveryData({
        codes: Array.isArray(data.recovery_codes) ? data.recovery_codes : [],
        requiresRelogin: Boolean(data.requires_relogin),
        message: data.message || "Nouveaux codes générés.",
      });
      await refreshMfa();
      setMode("mfa-codes");
    } catch (error) {
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de régénérer les codes de récupération."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    const text = (recoveryData?.codes || []).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ type: "success", message: "Codes de récupération copiés." });
    } catch {
      setStatus({ type: "error", message: "Copie automatique impossible. Copiez les codes manuellement." });
    }
  }

  function finishRecoveryCodes() {
    const requiresRelogin = recoveryData?.requiresRelogin;
    setRecoveryData(null);
    setMode(null);
    if (requiresRelogin) {
      clearSession();
      navigate("/login", { replace: true });
    }
  }

  const mfaStatusText = mfa.loading
    ? "Vérification…"
    : mfa.enabled
      ? `Activée · ${mfa.recovery_codes_remaining ?? 0} code(s) de récupération restant(s)`
      : "Désactivée · activation facultative";

  return (
    <>
      {status ? <div className={status.type === "error" ? "error-card" : "success-inline"} role={status.type === "error" ? "alert" : "status"}>{status.message}</div> : null}

      <section className="portal-card">
        <span className="section-label">Mon compte</span>
        <h3>Profil et sécurité</h3>

        <div className="setting-line">
          <div><b>Profil</b><span>{user?.display_name || user?.email}</span></div>
          <button type="button" onClick={() => setMode("profile")}>Modifier</button>
        </div>

        <div className="setting-line">
          <div><b>Adresse e-mail</b><span>{user?.email}</span></div>
          <button type="button" onClick={() => beginAccountSensitiveAction("change-email", "email")}>Modifier</button>
        </div>

        <div className="setting-line">
          <div><b>Mot de passe</b><span>{user?.has_password ? "Mot de passe local configuré" : "Compte sans mot de passe local"}</span></div>
          <button type="button" onClick={() => beginAccountSensitiveAction("set-password", "password")}>{user?.has_password ? "Modifier" : "Configurer"}</button>
        </div>

        <div className="setting-line setting-line--mfa">
          <div>
            <b>Authentification à deux facteurs</b>
            <span>{mfaStatusText}</span>
          </div>

          <div className="setting-actions">
            {!mfa.loading && !mfa.enabled ? (
              <button type="button" onClick={beginMfaSetup} disabled={busy}>Activer</button>
            ) : null}

            {!mfa.loading && mfa.enabled ? (
              <>
                <button type="button" onClick={() => beginMfaSensitiveAction("mfa-recovery", "mfa-regenerate")} disabled={busy}>Nouveaux codes</button>
                <button className="setting-action-danger" type="button" onClick={() => beginMfaSensitiveAction("mfa-disable", "mfa-disable")} disabled={busy}>Désactiver</button>
              </>
            ) : null}
          </div>
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
              <label><span>Langue</span><select name="locale" defaultValue={user?.locale || "fr"}><option value="fr">Français</option><option value="en">English</option><option value="mg">Malagasy</option></select></label>
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
              {mfa.enabled ? <VerificationFields /> : null}
              {!user?.has_password ? <div className="mfa-google-proof">✓ Identité Google vérifiée pour cette action.</div> : null}
              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Valider"}</button>
            </form>
          ) : null}

          {mode === "email" ? (
            <form className="portal-modal" onClick={(event) => event.stopPropagation()} onSubmit={emailSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Compte</span><h2>Changer d’adresse e-mail</h2>
              <label><span>Nouvelle adresse</span><input type="email" name="new_email" autoComplete="email" required /></label>
              {user?.has_password ? <label><span>Mot de passe actuel</span><input type="password" name="current_password" autoComplete="current-password" required /></label> : <div className="mfa-google-proof">✓ Identité Google vérifiée pour cette action.</div>}
              {mfa.enabled ? <VerificationFields /> : null}
              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer la confirmation"}</button>
            </form>
          ) : null}

          {mode === "mfa-setup-auth" ? (
            <form className="portal-modal portal-modal--mfa" onClick={(event) => event.stopPropagation()} onSubmit={setupMfaSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Sécurité</span>
              <h2>Activer le MFA</h2>
              <p className="detail-copy">L’activation est facultative. Confirmez d’abord votre identité avec votre mot de passe actuel.</p>
              <label><span>Mot de passe actuel</span><input type="password" name="current_password" autoComplete="current-password" required /></label>
              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Vérification…" : "Continuer"}</button>
            </form>
          ) : null}

          {mode === "mfa-confirm" && setupData ? (
            <form className="portal-modal portal-modal--mfa" onClick={(event) => event.stopPropagation()} onSubmit={confirmMfaSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Sécurité</span>
              <h2>Configurer Google Authenticator</h2>
              <p className="detail-copy">Scannez le QR Code avec votre application d’authentification puis saisissez le code à 6 chiffres.</p>

              <div className="mfa-qr-panel">
                {setupData.qr_code_data_url ? <img src={setupData.qr_code_data_url} alt="QR Code d’activation MFA" decoding="async" width="240" height="240" /> : null}
                <div>
                  <span>Clé manuelle</span>
                  <code>{setupData.secret}</code>
                  <small>{setupData.algorithm || "TOTP"} · {setupData.digits || 6} chiffres · {setupData.period || 30}s</small>
                </div>
              </div>

              <label>
                <span>Code Google Authenticator</span>
                <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" placeholder="000000" required />
              </label>

              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Activation…" : "Activer le MFA"}</button>
            </form>
          ) : null}

          {mode === "mfa-disable" ? (
            <form className="portal-modal portal-modal--mfa" onClick={(event) => event.stopPropagation()} onSubmit={disableMfaSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Sécurité</span>
              <h2>Désactiver le MFA</h2>
              <p className="detail-copy">Cette action réduit la protection du compte. Confirmez votre identité et fournissez un code MFA valide.</p>

              {user?.has_password ? <label><span>Mot de passe actuel</span><input type="password" name="current_password" autoComplete="current-password" required /></label> : <div className="mfa-google-proof">✓ Identité Google vérifiée pour cette action.</div>}

              <VerificationFields />

              <button className="danger-action" type="submit" disabled={busy}>{busy ? "Désactivation…" : "Désactiver le MFA"}</button>
            </form>
          ) : null}

          {mode === "mfa-regenerate" ? (
            <form className="portal-modal portal-modal--mfa" onClick={(event) => event.stopPropagation()} onSubmit={regenerateCodesSubmit}>
              <button type="button" className="modal-close" onClick={close}>×</button>
              <span className="section-label">Sécurité</span>
              <h2>Régénérer les codes de récupération</h2>
              <p className="detail-copy">Les anciens codes deviendront invalides. Enregistrez les nouveaux codes dans un endroit sûr.</p>

              {user?.has_password ? <label><span>Mot de passe actuel</span><input type="password" name="current_password" autoComplete="current-password" required /></label> : <div className="mfa-google-proof">✓ Identité Google vérifiée pour cette action.</div>}

              <VerificationFields />

              <button className="primary-action" type="submit" disabled={busy}>{busy ? "Génération…" : "Générer de nouveaux codes"}</button>
            </form>
          ) : null}

          {mode === "mfa-codes" && recoveryData ? (
            <section className="portal-modal portal-modal--mfa" onClick={(event) => event.stopPropagation()} aria-labelledby="mfa-codes-title">
              <span className="section-label">Sécurité</span>
              <h2 id="mfa-codes-title">Codes de récupération</h2>
              <p className="detail-copy">Ces codes sont affichés une seule fois. Chaque code ne peut être utilisé qu’une fois si vous n’avez pas accès à Google Authenticator.</p>

              <div className="mfa-recovery-codes" aria-label="Codes de récupération">
                {(recoveryData.codes || []).map((code) => <code key={code}>{code}</code>)}
              </div>

              {recoveryData.requiresRelogin ? <div className="mfa-relogin-note">Après avoir enregistré les codes, vous devrez vous reconnecter.</div> : null}

              <div className="mfa-modal-actions">
                <button className="secondary-action" type="button" onClick={copyRecoveryCodes}>Copier les codes</button>
                <button className="primary-action" type="button" onClick={finishRecoveryCodes}>J’ai enregistré les codes</button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function VerificationFields() {
  const [method, setMethod] = useState("mfa");
  return (
    <>
      <label>
        <span>Méthode de vérification</span>
        <select name="verification_method" value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="mfa">Google Authenticator</option>
          <option value="recovery">Code de récupération</option>
        </select>
      </label>
      <label>
        <span>{method === "recovery" ? "Code de récupération" : "Code à 6 chiffres"}</span>
        <input
          name="verification_code"
          inputMode={method === "mfa" ? "numeric" : "text"}
          autoComplete="one-time-code"
          pattern={method === "mfa" ? "[0-9]{6}" : undefined}
          maxLength={method === "mfa" ? 6 : undefined}
          required
        />
      </label>
    </>
  );
}
