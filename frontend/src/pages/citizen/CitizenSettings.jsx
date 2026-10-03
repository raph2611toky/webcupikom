import { useState } from "react";
import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import AccountSettingsCard from "../../components/ui/AccountSettingsCard.jsx";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenSettings() {
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  return (
    <div className="portal-layout">
      <CitizenSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Compte" title="Paramètres" />
        <main className="portal-content">
          <div className="settings-grid">
            <section className="portal-card">
              <span className="section-label">Notifications</span>
              <h3>Préférences locales</h3>
              <Toggle label="Notifications dans l’application" value={push} setValue={setPush} />
              <Toggle label="Notifications par e-mail" value={email} setValue={setEmail} />
              <Toggle label="Newsletter municipale" value={newsletter} setValue={setNewsletter} />
            </section>
            <AccountSettingsCard allowDelete />
            <section className="portal-card">
              <span className="section-label">Confidentialité</span>
              <h3>Votre session</h3>
              <p className="detail-copy">L’access token reste uniquement en mémoire. La session longue durée utilise le cookie HttpOnly fourni par le backend.</p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Toggle({ label, value, setValue }) {
  return <button className="toggle-line" type="button" onClick={() => setValue(!value)}><span>{label}</span><i className={value ? "is-on" : ""}><b /></i></button>;
}
