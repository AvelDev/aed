"use client";

import { useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";

/** Poziom arkusza: 0 = pasek z odległością, 1 = szczegóły, 2 = na całą wysokość. */
export type SheetLevel = 0 | 1 | 2;

export const clampLevel = (n: number): SheetLevel => Math.max(0, Math.min(2, n)) as SheetLevel;

/** Przesunięcie palcem (px), od którego zmieniamy poziom, i poniżej którego ruch to zwykłe dotknięcie. */
const SWIPE_PX = 24;
const TAP_PX = 8;

type Props = {
  sheet: RefObject<HTMLElement | null>;
  level: SheetLevel;
  /** Zmiana poziomu względem bieżącego; wynik jest przycinany do 0–2. */
  onLevel: (update: (l: SheetLevel) => number) => void;
};

/** Uchwyt arkusza na telefonie: przeciąganie, dotknięcie i strzałki na klawiaturze. */
export function SheetHandle({ sheet, level, onLevel }: Props) {
  const ta = useTranslations("a11y");
  const drag = useRef<{ y: number; h: number; body: HTMLElement } | null>(null);
  const toggle = () => onLevel((l) => (l > 0 ? 0 : 1));

  const endDrag = () => {
    drag.current?.body.style.removeProperty("max-height");
    sheet.current?.removeAttribute("data-drag");
    drag.current = null;
  };

  return (
    <button
      type="button"
      className="sheet__handle"
      aria-expanded={level > 0}
      aria-controls="sheet-body"
      aria-label={level > 0 ? ta("sheetCollapse") : ta("sheetExpand")}
      onPointerDown={(e) => {
        const body = sheet.current?.querySelector<HTMLElement>(".sheet__scroll");
        if (!body) return;
        drag.current = { y: e.clientY, h: body.getBoundingClientRect().height, body };
        sheet.current?.setAttribute("data-drag", "");
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // Arkusz podąża za palcem: wysokość treści między paskiem a pełnym rozwinięciem.
        const min = 12 * parseFloat(getComputedStyle(document.documentElement).fontSize);
        const actions = sheet.current?.querySelector<HTMLElement>(".actions")?.offsetHeight ?? 0;
        const room = (document.querySelector(".main")?.clientHeight ?? window.innerHeight) - 48 - actions;
        const max = Math.max(min, Math.min(d.body.scrollHeight, room));
        d.body.style.maxHeight = `${Math.min(max, Math.max(min, d.h - (e.clientY - d.y)))}px`;
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = e.clientY - d.y;
        endDrag();
        if (dy > SWIPE_PX) onLevel((l) => l - 1);
        else if (dy < -SWIPE_PX) onLevel((l) => l + 1);
        else if (Math.abs(dy) < TAP_PX) toggle();
      }}
      onPointerCancel={endDrag}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") onLevel((l) => l - 1);
        if (e.key === "ArrowUp") onLevel((l) => l + 1);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.detail === 0) toggle(); // klawiatura; dotyk obsługuje onPointerUp
      }}
    />
  );
}
