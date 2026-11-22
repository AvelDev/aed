// Kontrola kompletności i poprawności tłumaczeń. Uruchamiana przed każdym buildem.
// Błędy (kończą się kodem 1): brakujące/nadmiarowe klucze, puste teksty, błędna składnia ICU,
// różne argumenty lub tagi względem pl.json, niekompletne formy liczby mnogiej, zły alfabet,
// klucze użyte w kodzie, a nieistniejące. Ostrzeżenia: nieprzetłumaczone teksty, klucze nieużywane.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const LOCALES = ["pl", "en", "uk"] as const;
const SOURCE = "pl";
const DIR = "messages";

// Teksty, które mogą być identyczne we wszystkich językach (nazwy własne, skróty).
const SAME_OK = /^(AED|112|OpenStreetMap|CSV|GeoJSON|ZPE|ODbL|\{[a-z]+\})$/i;
const CYRILLIC = /[Ѐ-ӿ]/;
const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

type Tree = { [k: string]: string | Tree };
const errors: string[] = [];
const warnings: string[] = [];

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const catalogs = new Map<string, Map<string, string>>();
for (const l of LOCALES) {
  try {
    catalogs.set(l, flatten(JSON.parse(readFileSync(join(DIR, `${l}.json`), "utf8")) as Tree));
  } catch (e) {
    errors.push(`${l}.json: nie można wczytać (${(e as Error).message})`);
  }
}
const source = catalogs.get(SOURCE);
if (!source) {
  console.error(errors.join("\n"));
  process.exit(1);
}

type Sig = { args: string[]; tags: string[]; plurals: Map<string, Set<string>> };
function signature(msg: string): Sig {
  const sig: Sig = { args: [], tags: [], plurals: new Map() };
  const walk = (els: ReturnType<typeof parse>) => {
    for (const el of els) {
      switch (el.type) {
        case TYPE.argument: sig.args.push(`${el.value}:arg`); break;
        case TYPE.number: sig.args.push(`${el.value}:number`); break;
        case TYPE.date: sig.args.push(`${el.value}:date`); break;
        case TYPE.time: sig.args.push(`${el.value}:time`); break;
        case TYPE.select:
          sig.args.push(`${el.value}:select`);
          Object.values(el.options).forEach((o) => walk(o.value));
          break;
        case TYPE.plural:
          sig.args.push(`${el.value}:plural`);
          sig.plurals.set(el.value, new Set(Object.keys(el.options)));
          Object.values(el.options).forEach((o) => walk(o.value));
          break;
        case TYPE.tag:
          sig.tags.push(el.value);
          walk(el.children);
          break;
      }
    }
  };
  walk(parse(msg));
  sig.args = [...new Set(sig.args)].sort();
  sig.tags.sort();
  return sig;
}

for (const l of LOCALES) {
  const cat = catalogs.get(l);
  if (!cat) continue;

  for (const key of source.keys()) {
    if (!cat.has(key)) errors.push(`${l}: brak klucza "${key}"`);
  }
  for (const key of cat.keys()) {
    if (!source.has(key)) errors.push(`${l}: nadmiarowy klucz "${key}" (nie ma go w ${SOURCE}.json)`);
  }

  const categories = new Intl.PluralRules(l).resolvedOptions().pluralCategories;
  for (const [key, msg] of cat) {
    if (!msg.trim()) { errors.push(`${l}: pusty tekst w "${key}"`); continue; }

    let sig: Sig;
    try {
      sig = signature(msg);
    } catch (e) {
      errors.push(`${l}: błędna składnia ICU w "${key}": ${(e as Error).message}`);
      continue;
    }

    const src = source.get(key);
    if (src !== undefined && l !== SOURCE) {
      const s = signature(src);
      if (s.args.join() !== sig.args.join())
        errors.push(`${l}: "${key}" ma inne argumenty (${sig.args.join(", ") || "brak"}) niż ${SOURCE} (${s.args.join(", ") || "brak"})`);
      if (s.tags.join() !== sig.tags.join())
        errors.push(`${l}: "${key}" ma inne tagi niż ${SOURCE}`);

      if (msg === src && /[\p{L}]{4,}/u.test(msg) && !SAME_OK.test(msg.trim()))
        warnings.push(`${l}: "${key}" jest identyczny jak w ${SOURCE} (nieprzetłumaczony?)`);
    }

    for (const [arg, opts] of sig.plurals) {
      // Każda forma wymagana przez reguły języka (np. pl/uk: one, few, many, other) musi istnieć.
      const need = categories.filter((c) => c !== "zero");
      const missing = need.filter((c) => !opts.has(c));
      if (missing.length)
        errors.push(`${l}: "${key}" ({${arg}, plural}) brak form liczby mnogiej: ${missing.join(", ")}`);
    }

    // Alfabet: ukraiński musi zawierać cyrylicę, pl/en nie mogą jej zawierać; en bez polskich liter.
    const letters = msg.replace(/\{[^}]*\}|<[^>]*>/g, "");
    if (l === "uk" && /[\p{L}]{4,}/u.test(letters) && !CYRILLIC.test(letters) && !SAME_OK.test(msg.trim()))
      errors.push(`uk: "${key}" nie zawiera cyrylicy`);
    if (l !== "uk" && CYRILLIC.test(letters)) errors.push(`${l}: "${key}" zawiera cyrylicę`);
    if (l === "en" && POLISH_DIACRITICS.test(letters) && !/zpe\.gov|Resuscytacja|Dworcowa/.test(msg))
      warnings.push(`en: "${key}" zawiera polskie znaki (nieprzetłumaczony?)`);
  }
}

// Klucze użyte w kodzie vs. zdefiniowane.
function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, acc);
    else if (/\.(tsx?|mts)$/.test(name)) acc.push(p);
  }
  return acc;
}

const used = new Set<string>();
const dynamicPrefixes: string[] = [];
for (const file of walkFiles("src")) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/i18n-dynamic:\s*([\w.]+)\.\*/g)) dynamicPrefixes.push(m[1]);
  // const t = useTranslations("ns") / await getTranslations("ns") / getTranslations({ namespace: "ns", ... })
  const bindings: Array<{ name: string; ns: string; at: number }> = [];
  const BINDING =
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:["']([\w.]*)["']|\{[^}]*namespace:\s*["']([\w.]*)["'][^}]*\})?\s*\)/g;
  for (const m of text.matchAll(BINDING)) {
    bindings.push({ name: m[1], ns: m[2] ?? m[3] ?? "", at: m.index ?? 0 });
  }
  // Użycie t("klucz") należy do najbliższego poprzedzającego wiązania o tej samej nazwie.
  for (const name of new Set(bindings.map((b) => b.name))) {
    const re = new RegExp(`\\b${name}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*["']([\\w.]+)["']`, "g");
    for (const m of text.matchAll(re)) {
      const owner = bindings.filter((b) => b.name === name && b.at < (m.index ?? 0)).pop();
      if (owner) used.add(owner.ns ? `${owner.ns}.${m[1]}` : m[1]);
    }
  }
}
for (const key of used) {
  if (!source.has(key)) errors.push(`kod używa klucza "${key}", którego nie ma w ${SOURCE}.json`);
}
for (const key of source.keys()) {
  if (used.has(key)) continue;
  if (dynamicPrefixes.some((p) => key.startsWith(`${p}.`))) continue;
  warnings.push(`klucz "${key}" nie jest używany w kodzie`);
}

const total = source.size;
for (const w of warnings) console.warn(`  ostrzeżenie: ${w}`);
for (const e of errors) console.error(`  BŁĄD: ${e}`);
console.log(
  `i18n: ${LOCALES.length} języków × ${total} kluczy, ${errors.length} błędów, ${warnings.length} ostrzeżeń.`,
);
process.exit(errors.length ? 1 : 0);
