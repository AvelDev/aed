import type { Availability } from "@/lib/aed-data";
import type { IconName } from "./Icon";

export type BadgeKind = "ok" | "maybe" | "no";

/** Wygląd każdego stanu dostępności: kolor to tylko wsparcie, ikona i tekst niosą znaczenie. */
export const AVAILABILITY: Record<Availability, { kind: BadgeKind; icon: IconName; help?: "customersHelp" | "restrictedHelp" | "hoursHelp" }> = {
  open247: { kind: "ok", icon: "checkCircle" },
  openNow: { kind: "ok", icon: "checkCircle" },
  publicHoursUnknown: { kind: "maybe", icon: "clock", help: "hoursHelp" },
  customers: { kind: "maybe", icon: "users", help: "customersHelp" },
  unknown: { kind: "maybe", icon: "help", help: "restrictedHelp" },
  closedNow: { kind: "maybe", icon: "alert", help: "restrictedHelp" },
  permit: { kind: "no", icon: "key", help: "restrictedHelp" },
  private: { kind: "no", icon: "lock", help: "restrictedHelp" },
  noAccess: { kind: "no", icon: "ban", help: "restrictedHelp" },
};
