import { useState } from "react";
import AdminSidebar from "../../components/ui/AdminSidebar.jsx";
import PortalTopbar from "../../components/ui/PortalTopbar.jsx";
import { getApiErrorMessage, registerAgent } from "../../api/auth.js";
import { navigate } from "../../utils/navigation.js";
import "../../styles/app-shell.css";
import "../../styles/pages/dashboard.css";

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

export default function AgentRegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setStatus(null);

    if (form.password !== form.passwordConfirm) {
      setStatus({ type: "error", message: "Les mots de passe ne correspondent pas." });
      return;
    }

    setLoading(true);
    try {
      const data = await registerAgent({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
        password_confirm: form.passwordConfirm,
      });
      setStatus({
        type: "success",
        message: data.message || "Compte agent créé. Un email de vérification a été envoyé.",
      });
      setForm(initialForm);
    } catch (error) {
      setStatus({
        type: "error",
        message: getApiErrorMessage(error, "Impossible de créer le compte agent."),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-layout">
      <AdminSidebar />
      <div className="portal-main">
        <PortalTopbar
          eyebrow="Administration"
          title="Inscription d’un agent"
          actions={
            <button className="topbar-ghost" type="button" onClick={() => navigate("/admin/users")}>
              Retour aux utilisateurs
            </button>
          }
        />

        <main className="portal-content">
          <section className="portal-card settings-grid--narrow">
            <span className="section-label">Compte agent municipal</span>
            <h2>Créer un accès agent</h2>
            <p className="detail-copy">
              Le compte sera créé avec le rôle Agent. L’agent recevra ensuite le même email de vérification qu’un citoyen et pourra se connecter avec la page de connexion habituelle après validation.
            </p>

            {status?.type === "success" ? <div className="success-inline">{status.message}</div> : null}
            {status?.type === "error" ? <div className="error-card">{status.message}</div> : null}

            <form className="profile-form-grid" onSubmit={submit}>
              <label>
                <span>Prénom</span>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <label>
                <span>Nom</span>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <label className="span-2">
                <span>Adresse e-mail professionnelle</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="agent@novaterra.city"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <label>
                <span>Mot de passe</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength="8"
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <label>
                <span>Confirmation</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength="8"
                  value={form.passwordConfirm}
                  onChange={(event) => update("passwordConfirm", event.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <div className="span-2">
                <button className="primary-action" type="submit" disabled={loading}>
                  {loading ? "Création…" : "Créer le compte agent"}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
