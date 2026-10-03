import { useEffect, useMemo, useState } from "react";
import { clearGoogleFlow, getGoogleFlow, getApiErrorMessage } from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { isPathAllowedForRole, navigate, roleHome } from "../../utils/navigation.js";
import "../auth.css";

export default function GoogleCallbackPage() {
  const { completeGoogle } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const flow = useMemo(() => getGoogleFlow(), []);
  const [status, setStatus] = useState({ type: "info", message: "Connexion Google en cours…" });

  useEffect(() => {
    let mounted = true;
    const googleError = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (googleError || !code || !state) {
      clearGoogleFlow();
      setStatus({ type: "error", message: "La connexion Google a été annulée ou est incomplète." });
      return undefined;
    }

    completeGoogle({ code, state })
      .then((data) => {
        if (!mounted) return;

        if (data?.mfa_required) {
          const next = flow?.returnTo ? `&next=${encodeURIComponent(flow.returnTo)}` : "";
          clearGoogleFlow();
          navigate(`/login?mfa=1${next}`, { replace: true });
          return;
        }

        if (flow?.purpose === "delete-account") {
          clearGoogleFlow();
          const sameAccount =
            flow.expectedUserId === null ||
            String(flow.expectedUserId) === String(data.user?.id);

          if (!sameAccount) {
            navigate("/citizen/supprimer-compte?google_error=account_mismatch", { replace: true });
            return;
          }

          window.sessionStorage.setItem(
            "nova_terra_google_delete_verified",
            JSON.stringify({
              userId: data.user?.id,
              verifiedAt: Date.now(),
            }),
          );

          navigate(flow.returnTo || "/citizen/supprimer-compte", { replace: true });
          return;
        }

        const target = flow?.returnTo && isPathAllowedForRole(flow.returnTo, data.user?.role)
          ? flow.returnTo
          : roleHome(data.user?.role);
        clearGoogleFlow();
        navigate(target, { replace: true });
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus({ type: "error", message: getApiErrorMessage(error, "Connexion Google impossible.") });
      });

    return () => { mounted = false; };
  }, [completeGoogle, flow, params]);

  return (
    <main className="auth-page">
      <section className="auth-shell auth-shell--compact auth-shell--center" aria-labelledby="google-title">
        <a className="auth-brand" href="/">Nova<span>Terra</span></a>
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
