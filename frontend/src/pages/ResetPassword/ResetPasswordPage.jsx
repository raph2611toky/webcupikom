import { useMemo, useState } from "react";
import { confirmPasswordReset, getApiErrorMessage } from "../../api/auth.js";
import "../auth.css";

export default function ResetPasswordPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState(null);
  const linkValid = Boolean(uid && token);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus(null);
    if (password !== confirmation) {
      setStatus({ type: "error", message: "Les mots de passe ne correspondent pas." });
      return;
    }

    setLoading(true);
    try {
      const data = await confirmPasswordReset({
        uid,
        token,
        newPassword: password,
        newPasswordConfirm: confirmation,
      });
      setDone(true);
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Lien invalide ou expiré.") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--compact" aria-labelledby="reset-title">
        <a className="auth-brand" href="/">Terra<span>Nova</span></a>
        <div className="auth-intro">
          <span className="auth-kicker">Sécurité</span>
          <h1 id="reset-title">Nouveau mot de passe</h1>
          <p>Choisissez votre nouveau mot de passe.</p>
        </div>

        {linkValid && !done ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Nouveau mot de passe</span>
              <input type="password" autoComplete="new-password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
            </label>
            <label className="auth-field">
              <span>Confirmation</span>
              <input type="password" autoComplete="new-password" minLength="8" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={loading} required />
            </label>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </form>
        ) : null}

        {!linkValid ? <p className="auth-status auth-status--error">Lien de réinitialisation incomplet.</p> : null}
        {status ? <p className={`auth-status auth-status--${status.type}`}>{status.message}</p> : null}
        {done ? <p className="auth-switch"><a href="/login">Se connecter</a></p> : null}
      </section>
    </main>
  );
}
