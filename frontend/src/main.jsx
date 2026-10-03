import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/accessibility.css";
import { applyAccessibilityPreferences, loadAccessibilityPreferences } from "./utils/accessibility.js";

applyAccessibilityPreferences(loadAccessibilityPreferences());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
