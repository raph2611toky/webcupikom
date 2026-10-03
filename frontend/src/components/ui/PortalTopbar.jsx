import { getSession, navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

export default function PortalTopbar({ eyebrow, title, actions }) {
  const session = getSession();
  return (
    <header className="portal-topbar">
      <div>
        {eyebrow ? <span className="portal-topbar__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
      </div>
      <div className="portal-topbar__right">
        {actions}
        <button className="portal-topbar__icon" type="button" aria-label="Notifications" onClick={() => session?.role === "citizen" && navigate("/citizen/notifications")}>⌁</button>
        <div className="portal-user">
          <span className="portal-user__avatar">{(session?.name || "TN").slice(0, 2).toUpperCase()}</span>
          <div><strong>{session?.name || "Terra Nova"}</strong><span>{session?.role || "visiteur"}</span></div>
        </div>
      </div>
    </header>
  );
}
