"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "./Icon";

const TABS = [
  { href: "/", icon: "map" },
  { href: "/rko", icon: "heart" },
  { href: "/about", icon: "info" },
] as const;

export function Tabs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const labels = { "/": t("home"), "/rko": t("rko"), "/about": t("about") };
  return (
    <nav className="tabs" aria-label={t("label")}>
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
          <Icon name={tab.icon} />
          {labels[tab.href]}
        </Link>
      ))}
    </nav>
  );
}
