import type { Locale } from "@/i18n/routing";

/** Flagi jako SVG (emoji flag nie wyświetlają się w Windows). Flaga to ozdoba: nazwę języka niesie tekst. */
export function Flag({ locale }: { locale: Locale }) {
  return (
    <svg className="flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
      {locale === "pl" && (
        <>
          <rect width="30" height="10" fill="#fff" />
          <rect y="10" width="30" height="10" fill="#dc143c" />
        </>
      )}
      {locale === "uk" && (
        <>
          <rect width="30" height="10" fill="#0057b7" />
          <rect y="10" width="30" height="10" fill="#ffd700" />
        </>
      )}
      {locale === "en" && (
        <>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.5" />
          <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
          <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.4" />
        </>
      )}
    </svg>
  );
}
