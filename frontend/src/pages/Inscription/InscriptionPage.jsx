import { useState } from "react";
import { register } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../auth.css";

export default function InscriptionPage() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      await register({ firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email") });
      navigate("/citizen", { replace: true });
    } catch {
      setStatus("Inscription impossible pour le moment.");
    } finally { setLoading(false); }
  }
  return <main className="auth-page"><section className="auth-shell auth-shell--register" aria-labelledby="register-title">
    <a className="auth-brand" href="/" onClick={(e)=>{e.preventDefault();navigate('/')}} aria-label="Terra Nova, retour à l’accueil">Terra<span>Nova</span></a>
    <div className="auth-intro"><span className="auth-kicker">Créer votre espace citoyen</span><h1 id="register-title">Inscription</h1><p>Un seul compte pour vos services, démarches, notifications et informations municipales.</p></div>
    <form className="auth-form" onSubmit={handleSubmit}><div className="auth-grid"><label className="auth-field"><span>Prénom</span><input type="text" name="firstName" autoComplete="given-name" placeholder="Votre prénom" required/></label><label className="auth-field"><span>Nom</span><input type="text" name="lastName" autoComplete="family-name" placeholder="Votre nom" required/></label></div><label className="auth-field"><span>Adresse e-mail</span><input type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" required/></label><label className="auth-field"><span>Mot de passe</span><input type="password" name="password" autoComplete="new-password" placeholder="8 caractères minimum" minLength="8" required/></label><label className="auth-check auth-check--terms"><input type="checkbox" name="terms" required/><span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span></label><button className="auth-submit" type="submit" disabled={loading}>{loading?"Création…":"Créer mon compte"}</button>{status?<p className="auth-status">{status}</p>:null}</form>
    <p className="auth-switch">Déjà un compte ? <a href="/login" onClick={(e)=>{e.preventDefault();navigate('/login')}}>Se connecter</a></p>
  </section></main>;
}
