"use client";

import { useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "./Icon";

/* Preferencje wyglądu zapisane tylko w tej przeglądarce (localStorage), bez wysyłania na serwer.
   Ten sam klucz odczytuje skrypt w <head> (src/app/[locale]/layout.tsx), żeby nie było mignięcia. */
const KEY = "misja-aed:prefs";
type Prefs = { text: 0 | 1 | 2; contrast: boolean; motion: boolean };
const DEFAULTS: Prefs = { text: 0, contrast: false, motion: false };

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}
function parse(raw: string): Prefs {
  try {
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULTS;
  }
}
function save(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  const d = document.documentElement.dataset;
  d.text = String(p.text);
  d.contrast = p.contrast ? "high" : "";
  d.motion = p.motion ? "reduce" : "";
  listeners.forEach((l) => l());
}

export function AccessibilityMenu() {
  const t = useTranslations("a11y");
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const prefs = parse(raw);
  const dialog = useRef<HTMLDialogElement>(null);

  const sizes = [
    { v: 0, label: t("textNormal") },
    { v: 1, label: t("textLarge") },
    { v: 2, label: t("textXL") },
  ] as const;

  return (
    <>
      <button type="button" className="a11y-open" onClick={() => dialog.current?.showModal()}>
        <Icon name="accessibility" />
        <span>{t("panel")}</span>
      </button>
      <dialog
        ref={dialog}
        className="a11y"
        aria-labelledby="a11y-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="a11y__inner">
          <div className="a11y__head">
            <h2 id="a11y-title">{t("panelTitle")}</h2>
            <button type="button" className="a11y__close" onClick={() => dialog.current?.close()} aria-label={t("close")}>
              <Icon name="x" />
            </button>
          </div>

          <fieldset>
            <legend>{t("textSize")}</legend>
            <div className="a11y__sizes">
              {sizes.map((s) => (
                <button
                  key={s.v}
                  type="button"
                  className={`a11y__size a11y__size--${s.v}`}
                  aria-pressed={prefs.text === s.v}
                  onClick={() => save({ ...prefs, text: s.v })}
                >
                  <span aria-hidden="true">A</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="a11y__toggle">
            <input type="checkbox" checked={prefs.contrast} onChange={(e) => save({ ...prefs, contrast: e.target.checked })} />
            <span>{t("contrast")}</span>
          </label>
          <label className="a11y__toggle">
            <input type="checkbox" checked={prefs.motion} onChange={(e) => save({ ...prefs, motion: e.target.checked })} />
            <span>{t("motion")}</span>
          </label>

          <button type="button" className="btn btn--quiet" onClick={() => save(DEFAULTS)}>
            {t("reset")}
          </button>
        </div>
      </dialog>
    </>
  );
}
