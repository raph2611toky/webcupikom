import { useEffect, useState } from "react";
import { getSession, navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";

export default function PortalTopbar({ eyebrow, title, actions }) {
  const session = getSession();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState("");

  useEffect(() => {
    const openHelp = () => setHelpOpen(true);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("terra-help", openHelp);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("terra-help", openHelp);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeHelp() {
    setHelpOpen(false);
    setHelpQuestion("");
  }

  function openRequest(type = "question", message = "") {
    closeHelp();
    const params = new URLSearchParams({ new: "1", type });
    if (message.trim()) params.set("message", message.trim());
    navigate(`/citizen/requests?${params.toString()}`);
  }

  function submitHelp(event) {
    event.preventDefault();
    if (!helpQuestion.trim()) return;
    openRequest("question", helpQuestion);
  }

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

      {helpOpen ? <div className="portal-help-backdrop" onMouseDown={closeHelp}>
        <section className="portal-help portal-help--working" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-label="Assistant Nova Terra" aria-describedby="portal-help-description">
          <button className="portal-help__close" type="button" onClick={closeHelp}>×</button>
          <span className="section-label">Besoin d’aide</span>
          <h2>Que souhaitez-vous faire ?</h2>
          <p id="portal-help-description">Vous restez dans votre espace citoyen. Choisissez une action ou décrivez directement votre problème.</p>

          <div className="portal-help__choices portal-help__choices--4">
            <button type="button" onClick={() => openRequest("question")}><i aria-hidden="true">?</i><span>Poser une question</span><b>→</b></button>
            <button type="button" onClick={() => openRequest("signalement")}><i aria-hidden="true">!</i><span>Signaler un problème</span><b>→</b></button>
            <button type="button" onClick={() => { closeHelp(); navigate("/citizen/requests"); }}><i aria-hidden="true">◎</i><span>Suivre mes demandes</span><b>→</b></button>
            <button type="button" onClick={() => { closeHelp(); navigate("/citizen/services"); }}><i aria-hidden="true">◇</i><span>Trouver un service</span><b>→</b></button>
          </div>

          <form className="portal-help__ask portal-help__ask--working" onSubmit={submitHelp}>
            <label>
              <span>Ou décrivez votre besoin</span>
              <input value={helpQuestion} onChange={(event)=>setHelpQuestion(event.target.value)} aria-label="Votre question" placeholder="Ex. Je n’ai pas reçu mon document..." />
            </label>
            <button type="submit" disabled={!helpQuestion.trim()}>Continuer →</button>
          </form>
        </section>
      </div> : null}
    </>
  );
}
