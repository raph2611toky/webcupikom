import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { env } from "../../config/env.js";
import { navigate } from "../../router/navigation.js";
import "../auth.css";

export default function GoogleCallbackPage() {
  const { completeGoogle } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [status, setStatus] = useState({ type: "info", message: "Connexion Google en cours…" });

  useEffect(() => {
    let mounted = true;
    const googleError = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (googleError || !code || !state) {
      setStatus({ type: "error", message: "La connexion Google a été annulée ou est incomplète." });
      return undefined;
    }

    completeGoogle({ code, state })
      .then(() => {
        if (!mounted) return;
        navigate(env.authAfterLogin, { replace: true });
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus({ type: "error", message: getApiErrorMessage(error, "Connexion Google impossible.") });
      });

    return () => { mounted = false; };
  }, [completeGoogle, params]);

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--compact auth-shell--center" aria-labelledby="google-title">
        <a className="auth-brand" href="/">Kam<span>o</span></a>
        <div className="auth-intro">
          <span className="auth-kicker">Google</span>
          <h1 id="google-title">Authentification</h1>
        </div>
        <p className={`auth-status auth-status--${status.type}`}>{status.message}</p>
        {status.type === "error" ? <p className="auth-switch"><a href="/login">Retour à la connexion</a></p> : null}
      </section>
    </main>
  );
}
