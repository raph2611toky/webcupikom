import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { env } from "../../config/env.js";
import { navigate } from "../../router/navigation.js";
import "../auth.css";

export default function VerifyEmailPage() {
  const { verifyEmail } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [status, setStatus] = useState({ type: "info", message: "Vérification en cours…" });
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!uid || !token) {
      setStatus({ type: "error", message: "Lien de vérification incomplet." });
      return undefined;
    }

    verifyEmail({ uid, token })
      .then((data) => {
        if (!mounted) return;
        setVerified(true);
        setStatus({ type: "success", message: data.message });
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus({ type: "error", message: getApiErrorMessage(error, "Lien invalide ou expiré.") });
      });

    return () => { mounted = false; };
  }, [token, uid, verifyEmail]);

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--compact auth-shell--center" aria-labelledby="verify-title">
        <a className="auth-brand" href="/">Kam<span>o</span></a>
        <div className="auth-intro">
          <span className="auth-kicker">Compte</span>
          <h1 id="verify-title">Vérification e-mail</h1>
        </div>
        <p className={`auth-status auth-status--${status.type}`}>{status.message}</p>
        {verified ? (
          <button className="auth-submit" type="button" onClick={() => navigate(env.authAfterLogin, { replace: true })}>
            Continuer
          </button>
        ) : null}
      </section>
    </main>
  );
}
