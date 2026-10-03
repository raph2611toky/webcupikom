import AgentSidebar from "../../components/ui/AgentSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import AccountSettingsCard from "../../components/ui/AccountSettingsCard.jsx";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function AgentSettings() {
  return (
    <div className="portal-layout">
      <AgentSidebar />
      <div className="portal-main">
        <PortalTopbar eyebrow="Compte agent" title="Paramètres" />
        <main className="portal-content">
          <div className="settings-grid settings-grid--narrow">
            <AccountSettingsCard />
            <section className="portal-card">
              <span className="section-label">Sécurité</span>
              <h3>Session protégée</h3>
              <p className="detail-copy">L’access token reste en mémoire et la session longue durée repose sur le cookie HttpOnly émis par le backend.</p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
