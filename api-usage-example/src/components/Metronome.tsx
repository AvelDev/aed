"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "./Icon";

const BPM = 110; // w środku zalecanego zakresu 100–120 uciśnięć na minutę
const SERIES = 30;

export function Metronome() {
  const t = useTranslations("rko.metronome");
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!running) return;
    let n = 0;
    const click = (accent: boolean) => {
      const ctx = audio.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 1320 : 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    };
    const tick = () => {
      n = (n % SERIES) + 1;
      setCount(n);
      click(n === 1);
    };
    tick();
    const id = setInterval(tick, 60000 / BPM);
    return () => clearInterval(id);
  }, [running]);

  // Ekran nie gaśnie podczas resuscytacji.
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [running]);

  function toggle() {
    if (!running) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      setCount(0);
    }
    setRunning((r) => !r);
  }

  return (
    <section className="metronome" aria-labelledby="metronome-title">
      <h2 id="metronome-title">{t("title")}</h2>
      <p className="help">{t("description")}</p>
      <div className="metronome__beat" aria-hidden="true">
        <span key={count} className="metronome__count" data-pulse="1">
          {count || "–"}
        </span>
        <span>/ {SERIES}</span>
      </div>
      <div className="metronome__bar" aria-hidden="true">
        {Array.from({ length: SERIES }, (_, i) => (
          <span key={i} data-on={i < count ? "1" : "0"} />
        ))}
      </div>
      <button type="button" className="btn" onClick={toggle}>
        <Icon name={running ? "pause" : "play"} />
        {running ? t("stop") : t("start")}
      </button>
      <p className="help">
        <Icon name="volume" /> {t("silentHint")}
      </p>
      <p className="sr-only" role="status">
        {running ? t("count", { count }) : ""}
      </p>
    </section>
  );
}
