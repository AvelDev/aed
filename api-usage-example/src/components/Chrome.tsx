"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { BrandMark } from "./Icon";
import { LanguageMenu } from "./LanguageMenu";
import { Tabs } from "./Nav";

export function Header() {
  const t = useTranslations("brand");
  return (
    <header className="gov">
      <div className="flagbar" aria-hidden="true" />
      <div className="gov__top">
        <Link href="/" className="brand">
          <BrandMark className="brand__mark" />
          <span className="brand__text">
            <span className="brand__state">{t("state")}</span>
            <span className="brand__name">{t("name")}</span>
          </span>
        </Link>
        <div className="gov__tools">
          <AccessibilityMenu />
          <LanguageMenu />
        </div>
      </div>
    </header>
  );
}

/** Przełączanie ekranów na dole, wyraźnie oddzielone od treści. */
export function BottomNav() {
  return (
    <div className="bottomnav">
      <Tabs />
    </div>
  );
}

export function SkipLink() {
  const t = useTranslations("brand");
  return (
    <a className="skip" href="#main">
      {t("skipLink")}
    </a>
  );
}
