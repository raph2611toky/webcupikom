import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { env } from "./config/env.js";
import LandingPage from "./pages/Landing/LandingPage.jsx";
import LoginPage from "./pages/Login/LoginPage.jsx";
import InscriptionPage from "./pages/Inscription/InscriptionPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPassword/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPassword/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmail/VerifyEmailPage.jsx";
import GoogleCallbackPage from "./pages/GoogleCallback/GoogleCallbackPage.jsx";
import { navigate, normalizePath } from "./router/navigation.js";

function usePathname() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handleLocationChange = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return pathname;
}

function Redirect({ to }) {
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to]);
  return null;
}

function AuthLoading() {
  return (
    <main className="app-auth-loading" aria-label="Chargement de la session">
      <span />
    </main>
  );
}

function ProtectedRoute({ children }) {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) return <AuthLoading />;
  if (!isAuthenticated) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return <Redirect to={`/login?next=${next}`} />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return <AuthLoading />;
  if (isAuthenticated) return <Redirect to={env.authAfterLogin} />;
  return children;
}

export default function App() {
  const pathname = usePathname();

  switch (pathname) {
    case "/":
    case "/landing":
      return <LandingPage />;

    case "/login":
      return <GuestRoute><LoginPage /></GuestRoute>;

    case "/inscription":
      return <GuestRoute><InscriptionPage /></GuestRoute>;

    case "/mot-de-passe-oublie":
      return <GuestRoute><ForgotPasswordPage /></GuestRoute>;

    case "/reset-password":
      return <GuestRoute><ResetPasswordPage /></GuestRoute>;

    case "/verify-email":
      return <VerifyEmailPage />;

    case "/auth/google/callback":
      return <GoogleCallbackPage />;

    case "/app":
      return (
        <ProtectedRoute>
          <LandingPage />
        </ProtectedRoute>
      );

    default:
      return <Redirect to="/" />;
  }
}
