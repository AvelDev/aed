import type { routing } from "@/i18n/routing";
import type messages from "./messages/pl.json";

// Klucze tłumaczeń są typowane według pl.json: brakujący klucz w kodzie to błąd kompilacji.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
