import { useFormatter } from "next-intl";

/** Odległość w jednostkach lokalnych dla języka: "140 m", "1,2 km". */
export function useFormatDistance() {
  const f = useFormatter();
  return (meters: number) =>
    meters < 1000
      ? f.number(meters < 100 ? Math.round(meters) : Math.round(meters / 10) * 10, {
          style: "unit",
          unit: "meter",
          unitDisplay: "short",
        })
      : f.number(meters / 1000, {
          style: "unit",
          unit: "kilometer",
          unitDisplay: "short",
          maximumFractionDigits: meters < 10000 ? 1 : 0,
        });
}
