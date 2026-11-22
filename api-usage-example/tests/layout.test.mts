import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WIDE_QUERY } from "../src/hooks/useMediaQuery.ts";
import { routing } from "../src/i18n/routing.ts";
import { BRAND_COLORS } from "../src/lib/brand.ts";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

// CSS nie importuje stałych z TS, więc próg szerokiego układu jest zapisany dwa razy. Ten test to wymusza.
test("próg szerokiego ekranu w globals.css zgadza się z WIDE_QUERY", () => {
  assert.ok(css.includes(`@media ${WIDE_QUERY} {`), `brak "@media ${WIDE_QUERY}" w globals.css`);
});

test("kolory marki w TS są tymi samymi tokenami co w globals.css", () => {
  assert.ok(css.includes(`--red: ${BRAND_COLORS.red};`));
  assert.ok(css.includes(`--ink: ${BRAND_COLORS.ink};`));
});

// public/sw.js to zwykły plik statyczny bez importów, więc języki i trasy offline są w nim wpisane ręcznie.
test("service worker zna wszystkie języki i istniejące trasy", () => {
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const list = (name: string): string[] => {
    const m = new RegExp(String.raw`const ${name} = (\[[^\]]*\]);`).exec(sw);
    assert.ok(m, `brak ${name} w sw.js`);
    return JSON.parse(m[1]);
  };
  assert.deepEqual(list("LOCALES"), [...routing.locales]);
  for (const route of list("ROUTES")) {
    assert.ok(existsSync(new URL(`../src/app/[locale]${route}/page.tsx`, import.meta.url)), `brak strony ${route || "/"}`);
  }
});
