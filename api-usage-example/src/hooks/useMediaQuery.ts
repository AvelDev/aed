import { useSyncExternalStore } from "react";

/**
 * Szeroki ekran: panel po lewej, mapa po prawej. Ta sama wartość jest w globals.css
 * (CSS nie importuje stałych z TS); tests/layout.test.mts pilnuje, żeby się zgadzały.
 */
export const WIDE_QUERY = "(min-width: 820px)";

/** Bieżące dopasowanie zapytania media; na serwerze i przy pierwszym renderze `serverValue`. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
