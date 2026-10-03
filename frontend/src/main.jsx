import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { applyAccessibilityPreferences, loadAccessibilityPreferences } from "./utils/accessibility.js";
import { getLocale, setLocale } from "./utils/i18n.js";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/accessibility.css";

applyAccessibilityPreferences(loadAccessibilityPreferences());
setLocale(getLocale());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
