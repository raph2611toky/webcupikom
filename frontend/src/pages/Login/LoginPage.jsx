import { useState } from "react";
import { login } from "../../api/auth.js";
import { navigate, roleHome } from "../../utils/navigation.js";
import "../auth.css";

export default function LoginPage() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const session = await login({ email: form.get("email"), role: form.get("role") });
      const next = new URLSearchParams(window.location.search).get("next");
      navigate(next || roleHome(session.role), { replace: true });
    } catch {
      setStatus("Connexion impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="login-title">
        <a className="auth-brand" href="/" onClick={(e)=>{e.preventDefault();navigate('/')}} aria-label="Terra Nova, retour à l’accueil">Terra<span>Nova</span></a>
        <div className="auth-intro">
          <span className="auth-kicker">Portail municipal</span>
          <h1 id="login-title">Se connecter</h1>
          <p>Accédez à votre espace Terra Nova selon votre profil.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field"><span>Adresse e-mail</span><input type="email" name="email" autoComplete="email" placeholder="vous@terranova.city" required /></label>
          <label className="auth-field"><span>Mot de passe</span><input type="password" name="password" autoComplete="current-password" placeholder="Votre mot de passe" required /></label>
          <label className="auth-field"><span>Espace à ouvrir <small>· démo</small></span><select name="role" defaultValue="citizen"><option value="citizen">Citoyen</option><option value="agent">Agent municipal</option><option value="admin">Administrateur</option></select></label>
          <div className="auth-form-row"><label className="auth-check"><input type="checkbox" name="remember"/><span>Se souvenir de moi</span></label><a href="#mot-de-passe-oublie">Mot de passe oublié ?</a></div>
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
          {status ? <p className="auth-status">{status}</p> : null}
        </form>
        <p className="auth-switch">Pas encore de compte ? <a href="/inscription" onClick={(e)=>{e.preventDefault();navigate('/inscription')}}>Créer un compte</a></p>
      </section>
    </main>
  );
}
