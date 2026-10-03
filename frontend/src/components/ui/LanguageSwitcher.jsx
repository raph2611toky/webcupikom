import { LOCALE_LABELS, LOCALE_NAMES, useLocale } from "../../utils/i18n.js";
import "../../styles/app-shell.css";

export default function LanguageSwitcher({ className = "", compact = false, onChange }) {
  const [locale, setLocale] = useLocale();

  function change(event) {
    const next = event.target.value;
    setLocale(next);
    onChange?.(next);
  }

  return (
    <label className={`language-switcher ${compact ? "language-switcher--compact" : ""} ${className}`.trim()}>
      <span className="sr-only">{LOCALE_NAMES[locale]}</span>
      <select value={locale} onChange={change} aria-label="Choisir la langue">
        {Object.entries(LOCALE_LABELS).map(([value, label]) => (
          <option value={value} key={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}
