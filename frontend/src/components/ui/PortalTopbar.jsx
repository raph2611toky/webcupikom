import { useEffect, useState } from "react";
import { getSession, navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

export default function PortalTopbar({ eyebrow, title, actions }) {
  const session = getSession();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const openHelp = () => setHelpOpen(true);
    window.addEventListener("terra-help", openHelp);
    return () => window.removeEventListener("terra-help", openHelp);
  }, []);
  return (
    <>
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
          <div><strong>{session?.name || "Nova Terra"}</strong><span>{session?.role || "visiteur"}</span></div>
        </div>
      </div>
    </header>
    {helpOpen ? <div className="portal-help-backdrop" onMouseDown={() => setHelpOpen(false)}>
      <section className="portal-help" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-label="Assistant Nova Terra">
        <button className="portal-help__close" type="button" onClick={() => setHelpOpen(false)}>×</button>
        <span className="section-label">Assistant municipal</span>
        <h2>Comment pouvons-nous vous aider ?</h2>
        <p>Restez dans votre espace. Choisissez un besoin ou écrivez votre question.</p>
        <div className="portal-help__choices">
          <button type="button" onClick={() => { setHelpOpen(false); navigate("/citizen/requests"); }}>Suivre une démarche <b>→</b></button>
          <button type="button" onClick={() => { setHelpOpen(false); navigate("/citizen/services"); }}>Trouver un service <b>→</b></button>
          <button type="button" onClick={() => { setHelpOpen(false); navigate("/citizen/requests"); }}>Faire un signalement <b>→</b></button>
        </div>
        <form className="portal-help__ask" onSubmit={(event) => event.preventDefault()}>
          <input aria-label="Votre question" placeholder="Écrivez votre question…" />
          <button type="submit">Envoyer</button>
        </form>
        <small>Pour une urgence, utilisez directement le service concerné.</small>
      </section>
    </div> : null}
    </>
  );
}
