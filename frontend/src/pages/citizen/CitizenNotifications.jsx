import CitizenSidebar from "../../components/ui/CitizenSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

export default function CitizenNotifications(){
  return <div className="portal-layout"><CitizenSidebar/><div className="portal-main"><PortalTopbar eyebrow="Centre de notifications" title="Notifications"/><main className="portal-content"><section className="portal-card notification-list"><div className="empty-state"><h2>Aucune notification disponible</h2><p>Le backend actuel ne fournit pas encore de flux de notifications citoyennes.</p></div></section></main></div></div>;
}
