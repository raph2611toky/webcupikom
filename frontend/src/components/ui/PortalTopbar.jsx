import { useAuth } from "../../auth/AuthContext.jsx";
import { ROLE_LABELS } from "../../constants/roles.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

const ROLE_SHORTCUT = Object.freeze({
  citizen: { to: "/citizen/notifications", label: "Notifications", icon: "⌁" },
  agent: { to: "/agent/messages", label: "Messages citoyens", icon: "✉" },
  admin: { to: "/admin/messages", label: "Messages citoyens", icon: "✉" },
});

export default function PortalTopbar({ eyebrow, title, actions }) {
  const { user } = useAuth();
  const displayName = user?.display_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email || "Terra Nova";
  const initials = (displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "TN").toUpperCase();
  const shortcut = ROLE_SHORTCUT[user?.role];

  return (
    <header className="portal-topbar">
      <div>
        {eyebrow ? <span className="portal-topbar__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
      </div>
      <div className="portal-topbar__right">
        {actions}
        {shortcut ? <button className="portal-topbar__icon" type="button" aria-label={shortcut.label} onClick={() => navigate(shortcut.to)}>{shortcut.icon}</button> : null}
        <div className="portal-user">
          <span className="portal-user__avatar">{initials}</span>
          <div><strong>{displayName}</strong><span>{ROLE_LABELS[user?.role] || user?.role || "visiteur"}</span></div>
        </div>
      </div>
    </header>
  );
}
