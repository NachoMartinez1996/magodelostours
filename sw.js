const VERSION_CACHE = "1.8.00";
const CACHE_SHELL = `rosario-shell-${VERSION_CACHE}`;
const CACHE_RUNTIME = `rosario-runtime-${VERSION_CACHE}`;
const HOME_SHELL = "./index.html";
const GAME_SHELL = "./juegos.html";
const APP_SHELL = HOME_SHELL;

const shellFiles = [
    "./",
    "./index.html",
    "./juegos.html",
    "./admin.html",
    "./style.css",
    "./script.js",
    "./site.js",
    "./admin.js",
    "./firebase-config.js",
    "./manifest.json",
    "./share-qr.svg",
    "./Favicon/favicon.ico",
    "./Favicon/favicon-32x32.png",
    "./Favicon/favicon-16x16.png",
    "./Favicon/apple-icon-180x180.png",
    "./Favicon/android-icon-192x192.png",
    "./Favicon/android-icon-512x512.png",
    "./Logos/LogoGemini.png",
    "./Fotos%20sobre%20m%C3%AD/photo_2026-06-01_16-43-19.jpg"
];

function isUpdatableResource(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    return (
        request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "document" ||
        path.endsWith("/index.html") ||
        path.endsWith("/juegos.html") ||
        path.endsWith("/admin.html") ||
        path.endsWith("/script.js") ||
        path.endsWith("/site.js") ||
        path.endsWith("/admin.js") ||
        path.endsWith("/firebase-config.js") ||
        path.endsWith("/style.css") ||
        path.endsWith("/manifest.json") ||
        path.endsWith("/share-qr.svg")
    );
}

function getTargetCache(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    if (
        request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "document" ||
        path.endsWith("/index.html") ||
        path.endsWith("/juegos.html") ||
        path.endsWith("/admin.html") ||
        path.endsWith("/script.js") ||
        path.endsWith("/site.js") ||
        path.endsWith("/admin.js") ||
        path.endsWith("/firebase-config.js") ||
        path.endsWith("/style.css") ||
        path.endsWith("/manifest.json") ||
        path.endsWith("/share-qr.svg")
    ) {
        return CACHE_SHELL;
    }

    return CACHE_RUNTIME;
}

function isHttpRequest(request) {
    const url = new URL(request.url);
    return url.protocol === "http:" || url.protocol === "https:";
}

function isCacheableResponse(response) {
    return !!response && (response.ok || response.type === "opaque");
}

async function saveResponse(cacheName, request, response) {
    if (!isCacheableResponse(response)) {
        return response;
    }

    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    return response;
}

function getNavigationShellKey(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    if (path.endsWith("/juegos.html")) {
        return GAME_SHELL;
    }

    return HOME_SHELL;
}

async function getOfflineShell(request) {
    const preferredShell = request ? getNavigationShellKey(request) : APP_SHELL;

    return (
        await caches.match(preferredShell, { ignoreSearch: true }) ||
        await caches.match(HOME_SHELL, { ignoreSearch: true }) ||
        await caches.match(GAME_SHELL, { ignoreSearch: true }) ||
        await caches.match("./", { ignoreSearch: true })
    );
}

function createOfflineFallback() {
    return new Response(
        `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>El Mago de los Tours sin conexión</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #fbf4de;
      color: #14324a;
      font-family: "Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif;
      padding: 24px;
      text-align: center;
    }
    main {
      max-width: 30rem;
      padding: 24px;
      border-radius: 20px;
      border: 1px solid rgba(20, 50, 74, 0.12);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 18px 34px rgba(11, 52, 89, 0.12);
    }
    h1 {
      margin: 0 0 12px;
      color: #0b5ea8;
      font-size: 1.6rem;
    }
    p {
      margin: 0;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <main>
    <h1>El Mago de los Tours</h1>
    <p>No encontramos una copia local completa para abrir esta vez. Volvé a entrar una vez con conexión para guardar los archivos esenciales en este dispositivo.</p>
  </main>
</body>
</html>`,
        {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store"
            }
        }
    );
}

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_SHELL)
            .then(cache => cache.addAll(shellFiles))
    );
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    const isRosarioCache = cacheName.startsWith("rosario-");
                    const isCurrentCache = cacheName === CACHE_SHELL || cacheName === CACHE_RUNTIME;

                    if (isRosarioCache && !isCurrentCache) {
                        return caches.delete(cacheName);
                    }

                    return Promise.resolve(false);
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const { request } = event;

    if (request.method !== "GET" || !isHttpRequest(request)) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(request);
                await saveResponse(CACHE_SHELL, getNavigationShellKey(request), networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const offlineShell = await getOfflineShell(request);
                return offlineShell || createOfflineFallback();
            }
        })());
        return;
    }

    if (request.headers.has("range")) {
        return;
    }

    event.respondWith((async () => {
        if (isUpdatableResource(request)) {
            try {
                const networkResponse = await fetch(request);
                await saveResponse(getTargetCache(request), request, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const cachedResponse = await caches.match(request, { ignoreSearch: true });
                return cachedResponse || Response.error();
            }
        }

        const cachedResponse = await caches.match(request, { ignoreSearch: true });
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        await saveResponse(CACHE_RUNTIME, request, networkResponse.clone());
        return networkResponse;
    })().catch(async () => {
        const cachedResponse = await caches.match(request, { ignoreSearch: true });
        return cachedResponse || Response.error();
    }));
});
