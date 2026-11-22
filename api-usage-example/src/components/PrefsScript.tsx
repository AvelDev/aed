"use client";

import { useSyncExternalStore } from "react";

// Przywraca zapisane ustawienia dostępności (rozmiar tekstu, kontrast, animacje) przed pierwszym malowaniem.
const SCRIPT = `try{var p=JSON.parse(localStorage.getItem("misja-aed:prefs")||"{}"),d=document.documentElement.dataset;d.text=String(p.text||0);d.contrast=p.contrast?"high":"";d.motion=p.motion?"reduce":""}catch(e){}`;

const subscribe = () => () => {};

/**
 * Skrypt jest renderowany tylko w HTML z serwera (i podczas hydracji). Po stronie klienta, np. gdy zmienia się segment
 * języka, nie jest już tworzony, bo React 19 zgłasza błąd dla elementu <script> tworzonego w komponencie.
 */
export function PrefsScript() {
  const server = useSyncExternalStore(subscribe, () => false, () => true);
  if (!server) return null;
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
