import { useEffect, useMemo, useState } from "react";
import { confirmEmailChange } from "../../api/account.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navigate, roleHome } from "../../utils/navigation.js";
import "../auth.css";

export default function ConfirmEmailChangePage() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const [status, setStatus] = useState({ type: "info", message: "Confirmation en cours…" });
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      setStatus({ type: "error", message: "Lien de confirmation incomplet." });
      return undefined;
    }

    confirmEmailChange(token)
      .then(async (data) => {
        if (isAuthenticated) {
          try { await refreshUser(); } catch { /* La confirmation reste valide même si la session a expiré. */ }
        }
        if (!mounted) return;
        setDone(true);
        setStatus({ type: "success", message: data.message || "Adresse e-mail modifiée." });
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus({ type: "error", message: getApiErrorMessage(error, "Lien invalide ou expiré.") });
      });

    return () => { mounted = false; };
  }, [isAuthenticated, refreshUser, token]);

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--compact auth-shell--center" aria-labelledby="email-change-title">
        <a className="auth-brand" href="/">Terra<span>Nova</span></a>
        <div className="auth-intro">
          <span className="auth-kicker">Compte</span>
          <h1 id="email-change-title">Nouvelle adresse e-mail</h1>
        </div>
        <p className={`auth-status auth-status--${status.type}`}>{status.message}</p>
        {done ? (
          <button className="auth-submit" type="button" onClick={() => navigate(isAuthenticated ? roleHome(user?.role) : "/login", { replace: true })}>
            {isAuthenticated ? "Retour à mon espace" : "Se connecter"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
