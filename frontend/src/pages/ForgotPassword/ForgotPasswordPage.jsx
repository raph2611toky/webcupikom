import { useState } from "react";
import { getApiErrorMessage, requestPasswordReset } from "../../api/auth.js";
import "../auth.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const data = await requestPasswordReset(email);
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--compact" aria-labelledby="forgot-title">
        <a className="auth-brand" href="/">Nova<span>Terra</span></a>
        <div className="auth-intro">
          <span className="auth-kicker">Récupération</span>
          <h1 id="forgot-title">Mot de passe oublié</h1>
          <p>Indiquez votre adresse e-mail.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Adresse e-mail</span>
            <input type="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
          </label>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Envoi…" : "Envoyer le lien"}
          </button>
          {status ? <p className={`auth-status auth-status--${status.type}`}>{status.message}</p> : null}
        </form>

        <p className="auth-switch"><a href="/login">Retour à la connexion</a></p>
      </section>
    </main>
  );
}
