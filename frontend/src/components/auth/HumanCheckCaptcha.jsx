import { useMemo, useState } from "react";

const CAPTCHA_COPY = {
  fr: {
    label: "Vérification de sécurité",
    hint: "Résolvez ce calcul pour confirmer que vous êtes une personne.",
    placeholder: "Votre réponse",
    refresh: "Changer le calcul",
    valid: "Vérification réussie",
    invalid: "Réponse incorrecte",
  },
  en: {
    label: "Security check",
    hint: "Solve this calculation to confirm you are a person.",
    placeholder: "Your answer",
    refresh: "Change the calculation",
    valid: "Verification successful",
    invalid: "Incorrect answer",
  },
  mg: {
    label: "Fanamarinana fiarovana",
    hint: "Valio ity kajy ity hanamarinana fa olona ianao.",
    placeholder: "Valiny",
    refresh: "Hanova ny kajy",
    valid: "Vita ny fanamarinana",
    invalid: "Diso ny valiny",
  },
};

function makeChallenge() {
  const first = Math.floor(Math.random() * 8) + 2;
  const second = Math.floor(Math.random() * 8) + 1;
  return {
    prompt: `${first} + ${second}`,
    answer: String(first + second),
  };
}

export default function HumanCheckCaptcha({ locale = "fr", disabled = false, onValidChange }) {
  const copy = CAPTCHA_COPY[locale] || CAPTCHA_COPY.fr;
  const [challenge, setChallenge] = useState(makeChallenge);
  const [answer, setAnswer] = useState("");

  const isValid = useMemo(
    () => answer.trim() !== "" && answer.trim() === challenge.answer,
    [answer, challenge.answer],
  );

  function updateAnswer(event) {
    const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setAnswer(next);
    onValidChange?.(next !== "" && next === challenge.answer);
  }

  function refreshChallenge() {
    setChallenge(makeChallenge());
    setAnswer("");
    onValidChange?.(false);
  }

  return (
    <fieldset className={`auth-captcha${isValid ? " is-valid" : ""}`} disabled={disabled}>
      <legend>{copy.label}</legend>
      <p className="auth-captcha__hint">{copy.hint}</p>

      <div className="auth-captcha__row">
        <div className="auth-captcha__challenge" aria-label={`${copy.label}: ${challenge.prompt}`}>
          <span aria-hidden="true">{challenge.prompt}</span>
          <strong aria-hidden="true">=</strong>
        </div>

        <label className="auth-captcha__answer">
          <span className="sr-only">{copy.placeholder}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={answer}
            onChange={updateAnswer}
            placeholder={copy.placeholder}
            aria-invalid={answer.length > 0 && !isValid}
            required
          />
        </label>

        <button
          className="auth-captcha__refresh"
          type="button"
          onClick={refreshChallenge}
          aria-label={copy.refresh}
          title={copy.refresh}
        >
          ↻
        </button>
      </div>

      {answer ? (
        <p className={`auth-captcha__status ${isValid ? "is-valid" : "is-invalid"}`} role="status" aria-live="polite">
          {isValid ? `✓ ${copy.valid}` : copy.invalid}
        </p>
      ) : null}
    </fieldset>
  );
}
