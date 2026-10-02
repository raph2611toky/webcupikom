import { useEffect, useState } from "react";
import LandingPage from "./pages/Landing/LandingPage.jsx";
import LoginPage from "./pages/Login/LoginPage.jsx";
import InscriptionPage from "./pages/Inscription/InscriptionPage.jsx";

const ACCESS_TOKEN_KEY = "kamo_access_token";

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function usePathname() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(normalizePath(window.location.pathname));
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return pathname;
}

function redirect(to) {
  window.history.replaceState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, left: 0 });
}

function Redirect({ to }) {
  useEffect(() => {
    redirect(to);
  }, [to]);

  return null;
}

function ProtectedRoute({ children }) {
  const isAuthenticated = Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY));

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return <Redirect to={`/login?next=${next}`} />;
  }

  return children;
}

export default function App() {
  const pathname = usePathname();

  switch (pathname) {
    case "/":
    case "/landing":
      return <LandingPage />;

    case "/login":
      return <LoginPage />;

    case "/inscription":
      return <InscriptionPage />;

    // Première route privée. Le contenu pourra être remplacé par le dashboard
    // quand celui-ci sera créé. Le garde redirige vers /login sans token.
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
