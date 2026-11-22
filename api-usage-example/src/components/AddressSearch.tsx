"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GEOCODE_MAX_LENGTH, GEOCODE_MIN_LENGTH, type GeocodeResponse, type Place } from "@/lib/api-contracts";
import { Icon } from "./Icon";

export type { Place };

type State =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "error" }
  | { s: "done"; places: Place[] };

export function AddressSearch({ onPick }: { onPick: (p: Place) => void }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ s: "idle" });
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (text.length < GEOCODE_MIN_LENGTH) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ s: "loading" });
    try {
      // Na serwer idzie tylko wpisany tekst, nigdy współrzędne użytkownika.
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(text)}&lang=${locale}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as GeocodeResponse;
      setState({ s: "done", places: data.places });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setState({ s: "error" });
    }
  }

  function clear() {
    abort.current?.abort();
    setQ("");
    setState({ s: "idle" });
    input.current?.focus();
  }

  return (
    <div className="search">
      <form className="search__form" role="search" onSubmit={submit}>
        <div className="search__field">
          <label className="sr-only" htmlFor="address">
            {t("label")}
          </label>
          <input
            ref={input}
            id="address"
            className="search__input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={GEOCODE_MAX_LENGTH}
            placeholder={t("placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="search__clear" onClick={clear} aria-label={t("clear")}>
              <Icon name="x" />
            </button>
          )}
        </div>
        <button type="submit" className="search__go" aria-label={t("submit")}>
          <Icon name="search" />
        </button>
      </form>

      <div role="status" aria-live="polite">
        {state.s === "loading" && <p className="search__results search__note">{t("searching")}</p>}
        {state.s === "error" && <p className="search__results search__note">{t("error")}</p>}
        {state.s === "done" && state.places.length === 0 && <p className="search__results search__note">{t("noResults")}</p>}
      </div>
      {state.s === "done" && state.places.length > 0 && (
        <ul className="search__results" aria-label={t("results")}>
          {state.places.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setState({ s: "idle" });
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
