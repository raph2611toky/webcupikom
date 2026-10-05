import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getServices } from "../../api/services.js";
import { sendContactMessage } from "../../api/contact.js";
import { getApiErrorMessage } from "../../api/auth.js";
import { useLocale } from "../../utils/i18n.js";
import "./LandingContact.css";

const EASE = [0.16, 1, 0.3, 1];

const COPY = {
  fr: {
    kicker: "Contact",
    title: "Une question pour Nova Terra ?",
    text: "Envoyez un message court au bon service. Nous le transmettons directement à l’équipe concernée.",
    name: "Nom",
    email: "E-mail",
    service: "Service",
    subject: "Sujet",
    message: "Votre message",
    send: "Envoyer le message",
    sending: "Envoi...",
    success: "Message envoyé",
    successText: "Votre message a bien été transmis.",
    again: "Envoyer un autre message",
    error: "Impossible d’envoyer votre message.",
    loading: "Chargement...",
  },
  en: {
    kicker: "Contact",
    title: "A question for Nova Terra?",
    text: "Send a short message to the right service. We will route it directly to the relevant team.",
    name: "Name",
    email: "Email",
    service: "Service",
    subject: "Subject",
    message: "Your message",
    send: "Send message",
    sending: "Sending...",
    success: "Message sent",
    successText: "Your message has been successfully forwarded.",
    again: "Send another message",
    error: "Unable to send your message.",
    loading: "Loading...",
  },
  mg: {
    kicker: "Fifandraisana",
    title: "Manana fanontaniana ho an'i Nova Terra?",
    text: "Alefaso hafatra fohy amin'ny sampan-draharaha mety ary halefanay any amin'ny ekipa voakasika izany.",
    name: "Anarana",
    email: "Mailaka",
    service: "Sampan-draharaha",
    subject: "Lohateny",
    message: "Ny hafatrao",
    send: "Handefa hafatra",
    sending: "Mandefa...",
    success: "Nalefa ny hafatra",
    successText: "Voaray sy nalefa tsara ny hafatrao.",
    again: "Handefa hafatra hafa",
    error: "Tsy afaka mandefa ny hafatra.",
    loading: "Mampiditra...",
  },
};

const EMPTY_FORM = {
  name: "",
  email: "",
  service: "",
  subject: "",
  message: "",
};

export default function LandingContact() {
  const reduceMotion = useReducedMotion();
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;

  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getServices()
      .then((rows) => {
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        setServices(list);

        if (list.length) {
          const administration =
            list.find((service) =>
              String(service?.slug || service?.name || "")
                .toLowerCase()
                .includes("administr")
            ) || list[0];

          setForm((current) => ({
            ...current,
            service: current.service || String(administration.id),
          }));
        }
      })
      .catch(() => {
        if (active) setServices([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedService = useMemo(
    () =>
      services.find((service) => String(service.id) === String(form.service)) ||
      null,
    [services, form.service]
  );

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();

    if (!selectedService) {
      setError(copy.error);
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await sendContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        service: Number(selectedService.id),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });

      setSuccess(response?.reference || copy.success);
      setForm((current) => ({
        ...EMPTY_FORM,
        service: current.service,
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, copy.error));
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setSuccess("");
    setError("");
  }

  return (
    <section
      className="landing-contact"
      id="contact"
      aria-labelledby="landing-contact-title"
    >
      <svg
        className="landing-contact__tech"
        viewBox="0 0 1600 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 52h305l34 30h198" />
        <path d="M1065 82h198l34-30h303" />
        <path d="M0 455h248l35-28h265" />
        <path d="M1050 427h266l35 28h249" />
        <circle cx="331" cy="82" r="3" />
        <circle cx="1268" cy="82" r="3" />
      </svg>

      <motion.div
        className="landing-contact__copy"
        initial={reduceMotion ? false : { opacity: 0, x: -34 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.45 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <span className="landing-contact__kicker">{copy.kicker}</span>
        <h2 id="landing-contact-title">{copy.title}</h2>
        <p>{copy.text}</p>

        <a href="/contact" className="landing-contact__full-link">
          Centre de contact complet <span aria-hidden="true">→</span>
        </a>
      </motion.div>

      <motion.div
        className="landing-contact__panel"
        initial={reduceMotion ? false : { opacity: 0, x: 34, scale: 0.98 }}
        whileInView={{ opacity: 1, x: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.72, delay: reduceMotion ? 0 : 0.08, ease: EASE }}
      >
        {success ? (
          <div className="landing-contact__success" role="status" aria-live="polite">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>{copy.success}</strong>
              <p>{copy.successText}</p>
              <small>{success}</small>
            </div>
            <button type="button" onClick={reset}>{copy.again}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="landing-contact__form">
            <div className="landing-contact__row">
              <label>
                <span>{copy.name}</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => patch("name", event.target.value)}
                  autoComplete="name"
                />
              </label>

              <label>
                <span>{copy.email}</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => patch("email", event.target.value)}
                  autoComplete="email"
                />
              </label>
            </div>

            <div className="landing-contact__row landing-contact__row--small">
              <label>
                <span>{copy.service}</span>
                <select
                  required
                  value={form.service}
                  onChange={(event) => patch("service", event.target.value)}
                  disabled={!services.length}
                >
                  {!services.length ? <option value="">{copy.loading}</option> : null}
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{copy.subject}</span>
                <input
                  required
                  value={form.subject}
                  onChange={(event) => patch("subject", event.target.value)}
                />
              </label>
            </div>

            <label className="landing-contact__message">
              <span>{copy.message}</span>
              <textarea
                required
                rows="3"
                value={form.message}
                onChange={(event) => patch("message", event.target.value)}
              />
            </label>

            <div className="landing-contact__submit">
              <span>
                {selectedService?.name || copy.loading}
              </span>

              <button type="submit" disabled={sending || !selectedService}>
                {sending ? copy.sending : copy.send}
                <i aria-hidden="true">→</i>
              </button>
            </div>

            {error ? (
              <p className="landing-contact__error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </motion.div>
    </section>
  );
}
