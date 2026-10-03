import { useRef, useState } from "react";
import PublicHeader from "../../components/ui/PublicHeader.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { createCitizenRequest } from "../../api/requests.js";
import { currentCitizen } from "../../data/mockData.js";
import { CATEGORY_SERVICE, REQUEST_CATEGORIES, REQUEST_TYPES } from "../../constants/requestOptions.js";
import { getSession, navigate } from "../../utils/navigation.js";
import "../../styles/public-pages.css";

const initialForm = {
  type: "signalement",
  category: "Éclairage public",
  name: "",
  email: "",
  subject: "",
  message: "",
  location: "",
};

function formatBytes(bytes) {
  if (!bytes) return "0 Ko";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function Contact() {
  const session = getSession();
  const isCitizen = session?.role === "citizen";
  const [form, setForm] = useState(() => ({
    ...initialForm,
    name: isCitizen ? `${currentCitizen.firstName} ${currentCitizen.lastName}` : "",
    email: isCitizen ? currentCitizen.email : "",
  }));
  const [showExtras, setShowExtras] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [geoState, setGeoState] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const fileRef = useRef(null);

  const service = CATEGORY_SERVICE[form.category] || "Administration";

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function usePosition() {
    if (!navigator.geolocation) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setCoordinates({ latitude: lat, longitude: lng, accuracy: Math.round(position.coords.accuracy || 0) });
        if (!form.location) patch("location", `Position GPS · ${lat}, ${lng}`);
        setGeoState("done");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 },
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setProgress(12);

    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(92, value + Math.ceil((96 - value) * 0.18)));
    }, 130);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const request = await createCitizenRequest({
        source: isCitizen ? "citizen" : "public",
        type: form.type,
        category: form.category,
        service,
        subject: form.subject,
        message: form.message,
        citizen: isCitizen
          ? { id: currentCitizen.id, name: `${currentCitizen.firstName} ${currentCitizen.lastName}` }
          : { id: null, name: form.name || "Visiteur" },
        contact: { name: form.name, email: form.email },
        location: (form.location || coordinates)
          ? { label: form.location || "Position transmise", ...coordinates }
          : null,
        attachments: attachment ? [attachment] : [],
      });
      setProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      setSent(request);
    } finally {
      window.clearInterval(timer);
      setSending(false);
    }
  }

  function reset() {
    setSent(null);
    setProgress(0);
    setShowExtras(false);
    setAttachment(null);
    setCoordinates(null);
    setGeoState("idle");
    setForm({
      ...initialForm,
      name: isCitizen ? `${currentCitizen.firstName} ${currentCitizen.lastName}` : "",
      email: isCitizen ? currentCitizen.email : "",
    });
  }

  return (
    <div className="public-page public-page--contact public-page--smart-request">
      <PublicHeader />
      <main>
        <section className="public-hero public-hero--compact smart-request-hero smart-request-hero--simple">
          <span className="public-kicker">Aide & contact</span>
          <h1>Comment pouvons-nous <em>vous aider ?</em></h1>
          <p>Choisissez votre besoin, décrivez-le simplement et envoyez votre demande aux services municipaux.</p>
        </section>

        <section className="public-content smart-request-layout smart-request-layout--single">
          <div className="contact-form-panel smart-request-panel smart-request-panel--single">
            {sent ? (
              <div className="smart-request-success" role="status" aria-live="polite">
                <div className="smart-request-success__check" aria-hidden="true">✓</div>
                <div>
                  <span className="section-label">Demande transmise</span>
                  <h2>{sent.reference}</h2>
                  <p>Votre demande a bien été reçue par Nova Terra et orientée vers <b>{sent.service}</b>.</p>
                </div>
                <div className="smart-request-success__status">
                  <span>Statut</span><b>En attente</b>
                  <span>Catégorie</span><b>{sent.category}</b>
                </div>
                <div className="smart-request-success__actions">
                  {isCitizen ? <button className="primary-button" onClick={() => navigate(`/citizen/requests/${sent.reference}`)}>Suivre ma demande →</button> : null}
                  <button className="secondary-button" onClick={reset}>Nouvelle demande</button>
                </div>
                {!isCitizen ? <small>Conservez cette référence pour vos échanges avec la ville.</small> : null}
              </div>
            ) : (
              <form onSubmit={submit} className="public-form smart-request-form smart-request-form--simple">
                <div className="smart-request-types" aria-label="Type de demande">
                  {REQUEST_TYPES.map((item) => (
                    <button
                      type="button"
                      className={form.type === item.value ? "is-active" : ""}
                      key={item.value}
                      onClick={() => patch("type", item.value)}
                    >
                      <i>{item.icon}</i>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="smart-request-grid">
                  {!isCitizen ? (
                    <>
                      <label><span>Nom</span><input required value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Votre nom" /></label>
                      <label><span>E-mail</span><input required type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} placeholder="vous@exemple.com" /></label>
                    </>
                  ) : null}

                  <label className="span-2"><span>Catégorie</span><select value={form.category} onChange={(e) => patch("category", e.target.value)}>{REQUEST_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
                  <label className="span-2"><span>Sujet</span><input required value={form.subject} onChange={(e) => patch("subject", e.target.value)} placeholder="Ex. Lampadaire en panne devant le bloc Kepler" /></label>
                  <label className="span-2"><span>Message</span><textarea required rows="4" value={form.message} onChange={(e) => patch("message", e.target.value)} placeholder="Expliquez simplement votre question ou votre problème..." /></label>
                </div>

                <button
                  className="smart-request-extra-toggle"
                  type="button"
                  onClick={() => setShowExtras((value) => !value)}
                >
                  {showExtras ? "− Masquer les détails optionnels" : "+ Ajouter un lieu ou une photo"}
                </button>

                {showExtras ? (
                  <div className="smart-request-evidence smart-request-evidence--simple">
                    <div className="smart-request-location">
                      <label><span>Localisation <em>optionnel</em></span><input value={form.location} onChange={(e) => patch("location", e.target.value)} placeholder="Secteur, rue, bâtiment..." /></label>
                      <button type="button" onClick={usePosition} disabled={geoState === "loading"}>{geoState === "loading" ? "Localisation..." : geoState === "done" ? "✓ Position ajoutée" : "⌖ Utiliser ma position"}</button>
                    </div>
                    <div className="smart-request-attachment">
                      <input ref={fileRef} hidden type="file" accept="image/*,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                      <button type="button" onClick={() => fileRef.current?.click()}>＋ Ajouter photo / document</button>
                      {attachment ? <span><b>{attachment.name}</b><small>{formatBytes(attachment.size)}</small><button type="button" onClick={() => setAttachment(null)}>×</button></span> : null}
                    </div>
                  </div>
                ) : null}

                {geoState === "denied" ? <p className="smart-request-hint">La position n’a pas été autorisée. Vous pouvez saisir le lieu manuellement.</p> : null}

                <div className="smart-request-submit-row">
                  <div><span>Service destinataire</span><b>{service}</b></div>
                  <button className="primary-button" type="submit" disabled={sending}>{sending ? "Transmission en cours..." : "Envoyer ma demande →"}</button>
                </div>
                {sending ? <div className="smart-request-progress"><i style={{ width: `${progress}%` }} /><span>{progress}%</span></div> : null}
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
