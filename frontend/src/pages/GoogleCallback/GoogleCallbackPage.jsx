import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  clearGoogleFlow,
  getGoogleFlow,
  getApiErrorMessage,
  storeAccountGoogleProof,
} from "../../api/auth.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { isPathAllowedForRole, navigate, roleHome } from "../../utils/navigation.js";

const SUCCESS_DELAY = 1150;
const EASE = [0.16, 1, 0.3, 1];

export default function GoogleCallbackPage() {
  const { completeGoogle } = useAuth();
  const reduceMotion = useReducedMotion();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const flow = useMemo(() => getGoogleFlow(), []);

  // Important : aucune animation pendant la validation réelle du compte.
  // Le loader animé n'apparaît qu'une fois completeGoogle() terminé avec succès.
  const [phase, setPhase] = useState("checking");
  const [message, setMessage] = useState("Vérification sécurisée de votre compte Google…");

  useEffect(() => {
    let active = true;
    let redirectTimer = null;

    const googleError = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (googleError || !code || !state) {
      clearGoogleFlow();
      setPhase("error");
      setMessage("La connexion Google a été annulée ou est incomplète.");
      return undefined;
    }

    // Le code OAuth est à usage unique : on le retire de l'URL immédiatement.
    window.history.replaceState(
      window.history.state,
      document.title,
      window.location.pathname,
    );

    const sensitivePurpose = [
      "mfa-setup",
      "mfa-disable",
      "mfa-recovery",
      "set-password",
      "change-email",
      "delete-account",
    ].includes(flow?.purpose);

    if (sensitivePurpose) {
      storeAccountGoogleProof({ purpose: flow.purpose, code, state });
      const target = flow?.returnTo || "/citizen/settings";
      clearGoogleFlow();
      navigate(target, { replace: true });
      return undefined;
    }

    // completeGoogle() conserve sa logique existante et sa déduplication StrictMode.
    completeGoogle({ code, state })
      .then((data) => {
        if (!active) return;

        if (data?.mfa_required) {
          const next = flow?.returnTo
            ? `&next=${encodeURIComponent(flow.returnTo)}`
            : "";
          clearGoogleFlow();
          navigate(`/login?mfa=1${next}`, { replace: true });
          return;
        }

        const target =
          flow?.returnTo && isPathAllowedForRole(flow.returnTo, data.user?.role)
            ? flow.returnTo
            : roleHome(data.user?.role);

        // Le compte est maintenant réellement validé : seulement ici on anime.
        setPhase("success");
        setMessage("Votre compte est validé. Ouverture de votre espace…");

        redirectTimer = window.setTimeout(() => {
          clearGoogleFlow();
          navigate(target, { replace: true });
        }, reduceMotion ? 180 : SUCCESS_DELAY);
      })
      .catch((error) => {
        if (!active) return;
        clearGoogleFlow();
        setPhase("error");
        setMessage(getApiErrorMessage(error, "Connexion Google impossible."));
      });

    return () => {
      active = false;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [completeGoogle, flow, params, reduceMotion]);

  return (
    <main className={`google-callback-v2 google-callback-v2--${phase}`}>
      <style>{`
        .google-callback-v2 {
          --gc-purple: #7c3aed;
          --gc-violet: #9557ff;
          --gc-ink: #17131f;
          --gc-muted: #6f687a;
          min-height: 100dvh;
          width: 100%;
          display: grid;
          place-items: center;
          padding: 28px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at 50% 38%, rgba(124, 58, 237, 0.07), transparent 33%),
            linear-gradient(180deg, #fbfaff 0%, #f7f5fb 100%);
          color: var(--gc-ink);
        }

        .google-callback-v2::before,
        .google-callback-v2::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(2px);
        }

        .google-callback-v2::before {
          width: 420px;
          height: 420px;
          left: -240px;
          top: -230px;
          background: rgba(124, 58, 237, 0.055);
        }

        .google-callback-v2::after {
          width: 360px;
          height: 360px;
          right: -210px;
          bottom: -220px;
          background: rgba(149, 87, 255, 0.05);
        }

        .google-callback-v2__card {
          width: min(430px, 100%);
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 34px 34px 30px;
          border: 1px solid rgba(71, 52, 93, 0.1);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 24px 65px rgba(53, 35, 75, 0.1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .google-callback-v2__brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .google-callback-v2__brand-mark {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: #fff;
          font-size: 11px;
          letter-spacing: -0.04em;
          background: linear-gradient(145deg, #6d28d9, #a855f7);
          box-shadow: 0 8px 20px rgba(124, 58, 237, 0.22);
        }

        .google-callback-v2__brand span:last-child strong {
          color: var(--gc-purple);
        }

        .google-callback-v2__static-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 20px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          border: 1px solid rgba(124, 58, 237, 0.12);
          background: #faf8ff;
          color: var(--gc-purple);
          font-size: 22px;
          font-weight: 800;
        }

        .google-callback-v2__title {
          margin: 0;
          font-size: clamp(23px, 4vw, 29px);
          line-height: 1.15;
          letter-spacing: -0.04em;
          font-weight: 800;
        }

        .google-callback-v2__message {
          max-width: 330px;
          margin: 12px auto 0;
          color: var(--gc-muted);
          font-size: 14px;
          line-height: 1.65;
        }

        .google-callback-v2__security {
          margin-top: 24px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #837b8d;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .google-callback-v2__security-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22a06b;
        }

        /* Loader visible UNIQUEMENT après succès de completeGoogle(). */
        .google-callback-v2__loader {
          width: 112px;
          height: 112px;
          margin: 2px auto 24px;
          position: relative;
          display: grid;
          place-items: center;
        }

        .google-callback-v2__halo {
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.11), rgba(124, 58, 237, 0) 68%);
          animation: gcHalo 1.6s ease-in-out infinite;
        }

        .google-callback-v2__ring {
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          border: 2px solid rgba(124, 58, 237, 0.11);
          border-top-color: rgba(124, 58, 237, 0.9);
          border-right-color: rgba(149, 87, 255, 0.48);
          animation: gcSpin 1.15s linear infinite;
        }

        .google-callback-v2__orbit-dot {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          top: 11px;
          left: calc(50% - 4px);
          background: #8b5cf6;
          box-shadow: 0 0 16px rgba(124, 58, 237, 0.65);
          transform-origin: 4px 45px;
          animation: gcOrbit 1.15s linear infinite;
        }

        .google-callback-v2__check {
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          border-radius: 19px;
          background: linear-gradient(145deg, #6d28d9, #9f50f5);
          box-shadow: 0 14px 30px rgba(124, 58, 237, 0.24);
          color: #fff;
          font-size: 30px;
          font-weight: 700;
        }

        .google-callback-v2__progress {
          height: 4px;
          width: min(250px, 75%);
          margin: 25px auto 0;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.09);
        }

        .google-callback-v2__progress > span {
          display: block;
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #6d28d9, #a855f7);
          animation: gcProgress 1.05s cubic-bezier(.4, 0, .2, 1) infinite;
        }

        .google-callback-v2__error-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 20px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          color: #b42318;
          background: #fff1f0;
          border: 1px solid #ffd9d5;
          font-size: 25px;
          font-weight: 800;
        }

        .google-callback-v2__back {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          min-height: 42px;
          margin-top: 22px;
          padding: 0 18px;
          border-radius: 12px;
          color: #fff;
          background: #17131f;
          text-decoration: none;
          font-size: 13px;
          font-weight: 750;
          transition: transform .18s ease, opacity .18s ease;
        }

        .google-callback-v2__back:hover {
          transform: translateY(-1px);
          opacity: .92;
        }

        @keyframes gcSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes gcOrbit {
          to { transform: rotate(360deg); }
        }

        @keyframes gcHalo {
          0%, 100% { transform: scale(.94); opacity: .55; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        @keyframes gcProgress {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(340%); }
        }

        @media (max-width: 560px) {
          .google-callback-v2 {
            padding: 18px;
          }

          .google-callback-v2__card {
            padding: 29px 22px 26px;
            border-radius: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .google-callback-v2__halo,
          .google-callback-v2__ring,
          .google-callback-v2__orbit-dot,
          .google-callback-v2__progress > span {
            animation: none !important;
          }
        }
      `}</style>

      {phase === "checking" && (
        <section className="google-callback-v2__card" aria-labelledby="google-checking-title">
          <div className="google-callback-v2__brand" aria-label="Nova Terra">
            <span className="google-callback-v2__brand-mark">NT</span>
            <span>Nova<strong>Terra</strong></span>
          </div>

          <div className="google-callback-v2__static-icon" aria-hidden="true">G</div>
          <h1 id="google-checking-title" className="google-callback-v2__title">
            Validation du compte
          </h1>
          <p className="google-callback-v2__message">{message}</p>

          <div className="google-callback-v2__security" aria-hidden="true">
            <span className="google-callback-v2__security-dot" />
            Connexion sécurisée
          </div>
        </section>
      )}

      {phase === "success" && (
        <motion.section
          className="google-callback-v2__card"
          aria-labelledby="google-success-title"
          role="status"
          aria-live="polite"
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.34, ease: EASE }}
        >
          <motion.div
            className="google-callback-v2__loader"
            initial={reduceMotion ? false : { scale: 0.84, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
            aria-hidden="true"
          >
            <span className="google-callback-v2__halo" />
            <span className="google-callback-v2__ring" />
            <span className="google-callback-v2__orbit-dot" />
            <motion.span
              className="google-callback-v2__check"
              initial={reduceMotion ? false : { scale: 0.65, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.08, duration: 0.38, ease: EASE }}
            >
              ✓
            </motion.span>
          </motion.div>

          <motion.h1
            id="google-success-title"
            className="google-callback-v2__title"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3, ease: EASE }}
          >
            Compte validé
          </motion.h1>

          <motion.p
            className="google-callback-v2__message"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.3 }}
          >
            {message}
          </motion.p>

          <div className="google-callback-v2__progress" aria-hidden="true">
            <span />
          </div>
        </motion.section>
      )}

      {phase === "error" && (
        <section className="google-callback-v2__card" aria-labelledby="google-error-title">
          <div className="google-callback-v2__brand" aria-label="Nova Terra">
            <span className="google-callback-v2__brand-mark">NT</span>
            <span>Nova<strong>Terra</strong></span>
          </div>

          <div className="google-callback-v2__error-icon" aria-hidden="true">!</div>
          <h1 id="google-error-title" className="google-callback-v2__title">
            Connexion interrompue
          </h1>
          <p className="google-callback-v2__message">{message}</p>
          <a className="google-callback-v2__back" href="/login">
            Retour à la connexion
          </a>
        </section>
      )}
    </main>
  );
}
