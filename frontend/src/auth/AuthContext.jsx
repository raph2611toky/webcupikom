import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  bootstrapSession,
  completeGoogleAuth,
  invalidateSessionBootstrap,
  login as loginRequest,
  logout as logoutRequest,
  verifyEmail as verifyEmailRequest,
} from "../api/auth.js";
import { clearAccessToken, setUnauthorizedHandler } from "../api/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    setUnauthorizedHandler(() => {
      clearAccessToken();
      invalidateSessionBootstrap();
      setUser(null);
    });

    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    const skipBootstrap = pathname === "/auth/google/callback" || pathname === "/verify-email";

    if (skipBootstrap) {
      setReady(true);
    } else {
      bootstrapSession().then((restoredUser) => {
        if (!mounted) return;
        setUser(restoredUser);
        setReady(true);
      });
    }

    return () => {
      mounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    setUser(data.user);
    return data;
  }, []);

  const completeGoogle = useCallback(async (params) => {
    const data = await completeGoogleAuth(params);
    setUser(data.user);
    return data;
  }, []);

  const verifyEmail = useCallback(async (params) => {
    const data = await verifyEmailRequest(params);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      login,
      completeGoogle,
      verifyEmail,
      logout,
    }),
    [completeGoogle, login, logout, ready, user, verifyEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans AuthProvider.");
  }
  return context;
}
