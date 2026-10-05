import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LOCALE_LABELS, LOCALE_NAMES, useLocale } from "../../utils/i18n.js";
import "../../styles/language-switcher-v110.css";

const LOCALES = ["fr", "en", "mg"];
const MENU_WIDTH = 218;
const VIEWPORT_GAP = 8;

function LocaleFlag({ locale }) {
  if (locale === "fr") {
    return <svg viewBox="0 0 24 16" aria-hidden="true"><rect width="8" height="16" fill="#1f45a8"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ef3340"/></svg>;
  }
  if (locale === "mg") {
    return <svg viewBox="0 0 24 16" aria-hidden="true"><rect width="8" height="16" fill="#fff"/><rect x="8" width="16" height="8" fill="#d71920"/><rect x="8" y="8" width="16" height="8" fill="#2b8c4b"/></svg>;
  }
  return <svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#21468b"/><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4"/><path d="M0 0 24 16M24 0 0 16" stroke="#cf142b" strokeWidth="1.8"/><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5"/><path d="M12 0v16M0 8h24" stroke="#cf142b" strokeWidth="2.6"/></svg>;
}

export default function LanguageSwitcher({ className = "", compact = false, onChange }) {
  const [locale, setLocale] = useLocale();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: VIEWPORT_GAP, top: 56 });
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const placeMenu = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;
    const rect = button.getBoundingClientRect();
    const left = Math.max(VIEWPORT_GAP, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP));
    const estimatedHeight = 164;
    const below = rect.bottom + 8;
    const top = below + estimatedHeight <= window.innerHeight - VIEWPORT_GAP
      ? below
      : Math.max(VIEWPORT_GAP, rect.top - estimatedHeight - 8);
    setPosition({ left, top });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    placeMenu();
    const sync = () => placeMenu();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    function closeOutside(event) {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function choose(next) {
    setLocale(next);
    onChange?.(next);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  const menu = open && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="language-switcher__menu"
          role="menu"
          aria-label="Choisir la langue"
          style={{ left: position.left, top: position.top }}
        >
          {LOCALES.map((value) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={locale === value}
              className={locale === value ? "is-active" : ""}
              key={value}
              onClick={() => choose(value)}
            >
              <span className="language-switcher__option-flag" aria-hidden="true"><LocaleFlag locale={value}/></span>
              <span><strong>{LOCALE_NAMES[value]}</strong><small>{LOCALE_LABELS[value]}</small></span>
              <i aria-hidden="true">{locale === value ? "✓" : ""}</i>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return <>
    <div ref={rootRef} className={`language-switcher language-switcher--menu ${compact ? "language-switcher--compact" : ""} ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="language-switcher__button"
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="language-switcher__flag" aria-hidden="true"><LocaleFlag locale={locale}/></span>
        <strong>{LOCALE_LABELS[locale] || locale.toUpperCase()}</strong>
        <span className="language-switcher__chevron" aria-hidden="true">⌄</span>
      </button>
    </div>
    {menu}
  </>;
}
