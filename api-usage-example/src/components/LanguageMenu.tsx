"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSwitchLocale } from "./LocaleShell";
import { LANGUAGE_NAMES, routing, type Locale } from "@/i18n/routing";
import { Flag } from "./Flag";
import { Icon } from "./Icon";

/** Lista rozwijana języków. Zmiana języka to nawigacja po stronie klienta: bez przeładowania strony, stan aplikacji zostaje. */
export function LanguageMenu() {
  const t = useTranslations("nav");
  const current = useLocale() as Locale;
  const switchLocale = useSwitchLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (l: Locale) => {
    setOpen(false);
    button.current?.focus();
    switchLocale(l);
  };

  return (
    <div className="langmenu" ref={root}>
      <button
        ref={button}
        type="button"
        className="langmenu__button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t("languageMenu")}: ${LANGUAGE_NAMES[current]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Flag locale={current} />
        <span aria-hidden="true">{current.toUpperCase()}</span>
        <Icon name="chevronDown" className="langmenu__chevron" />
      </button>
      {open && (
        <ul id={listId} className="langmenu__list">
          {routing.locales.map((l) => (
            <li key={l}>
              <button type="button" lang={l} aria-current={l === current ? "true" : undefined} onClick={() => choose(l)}>
                <Flag locale={l} />
                <span>{LANGUAGE_NAMES[l]}</span>
                {l === current && <Icon name="checkCircle" className="langmenu__check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
