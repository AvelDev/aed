import { useEffect, useState, useSyncExternalStore } from "react";
import { distanceMeters } from "@/lib/geo";

export type Gps =
  | { status: "locating" }
  | { status: "ok"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "unavailable" };

/** Ruchy mniejsze niż ten próg nie zmieniają pozycji (bez przeliczania wyniku przy drganiach GPS). */
const MIN_MOVE_M = 25;

const noopSubscribe = () => () => {};

/**
 * Pozycja urządzenia. Zostaje w pamięci tej karty: nie jest zapisywana ani wysyłana na serwer.
 * `retry` ponawia prośbę po odmowie lub błędzie, nie gubiąc znanej już pozycji.
 */
export function useGeolocation(): { gps: Gps; retry: () => void } {
  const supported = useSyncExternalStore(noopSubscribe, () => "geolocation" in navigator, () => true);
  const [state, setState] = useState<Gps>({ status: "locating" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    const onOk = (p: GeolocationPosition) => {
      if (!active) return;
      setState((g) =>
        g.status === "ok" && distanceMeters(g.lat, g.lon, p.coords.latitude, p.coords.longitude) < MIN_MOVE_M
          ? g
          : { status: "ok", lat: p.coords.latitude, lon: p.coords.longitude },
      );
    };
    const onErr = (err: GeolocationPositionError) => {
      if (!active) return;
      setState((g) => (g.status === "ok" ? g : { status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }));
    };
    // Safari: pierwsze zapytanie robimy getCurrentPosition (bez wysokiej dokładności, bez limitu czasu
    // liczonego w trakcie pytania o zgodę), a watchPosition dopiero po otrzymaniu pozycji. Samo
    // watchPosition z enableHighAccuracy i krótkim timeoutem w Safari kończy się błędem lub nie wyświetla pytania.
    let watchId: number | null = null;
    const startWatch = () => {
      if (!active || watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(onOk, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 60000,
      });
    };
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onOk(p);
        startWatch();
      },
      (err) => {
        onErr(err);
        if (err.code !== err.PERMISSION_DENIED) startWatch();
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
    return () => {
      active = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [supported, attempt]);

  const retry = () => {
    setState((g) => (g.status === "ok" ? g : { status: "locating" }));
    setAttempt((n) => n + 1);
  };
  return { gps: supported ? state : { status: "unavailable" }, retry };
}
