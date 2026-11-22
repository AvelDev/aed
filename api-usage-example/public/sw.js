/* Service worker Misja AED: aplikacja działa bez sieci po pierwszym otwarciu.
   - strony: najpierw sieć (2,5 s), potem zapis w pamięci, na końcu strona offline;
   - dane AED: z pamięci od razu, odświeżane w tle;
   - pliki statyczne: z pamięci;
   - kafelki mapy: z pamięci, z limitem liczby;
   - API: nigdy nie trafia do pamięci (nic prywatnego nie jest zapisywane). */
const VERSION = "v4"; // v4: dane z API dane-gov-pl-mirror (format aed.json w wersji 2)
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const DATA = `data-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const TILE_LIMIT = 400;
const LOCALES = ["pl", "en", "uk"];
const ROUTES = ["", "/rko", "/about"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      const statics = await caches.open(STATIC);
      await (await caches.open(DATA)).add("/data/aed.json").catch(() => {});
      await pages.add("/offline.html").catch(() => {});

      // Strony wszystkich języków oraz pliki /_next/static, do których się odwołują.
      const assets = new Set(["/fonts/source-sans-3-latin.woff2", "/fonts/source-sans-3-latin-ext.woff2", "/fonts/source-sans-3-cyrillic.woff2", "/icons/icon-192.png"]);
      for (const l of LOCALES) {
        for (const r of ROUTES) {
          try {
            const res = await fetch(`/${l}${r}`, { credentials: "same-origin" });
            if (!res.ok) continue;
            await pages.put(`/${l}${r}`, res.clone());
            const html = await res.text();
            for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0]);
          } catch {}
        }
      }
      await Promise.all([...assets].map((a) => statics.add(a).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC, DATA, TILES]);
      for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "tile.openstreetmap.org") {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === "opaque") { cache.put(req, res.clone()); trim(TILES, TILE_LIMIT); }
          return res;
        } catch {
          return hit || Response.error();
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // API nigdy z pamięci

  if (url.pathname === "/data/aed.json") {
    event.respondWith(
      caches.open(DATA).then(async (cache) => {
        const hit = await cache.match(req);
        const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
        return hit || (await refresh) || Response.error();
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await withTimeout(fetch(req), 2500);
          if (res.ok) cache.put(url.pathname, res.clone());
          return res;
        } catch {
          // Adres główny (start_url zainstalowanej aplikacji) przekierowuje na język; offline wybieramy go sami.
          let path = url.pathname;
          if (path === "/") {
            const wanted = (req.headers.get("accept-language") || "").toLowerCase();
            path = "/" + (LOCALES.find((l) => wanted.startsWith(l) || wanted.includes("," + l)) || "pl");
          }
          return (await cache.match(path)) || (await cache.match("/offline.html")) || Response.error();
        }
      })(),
    );
  }
});
