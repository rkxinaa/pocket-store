const STATIC_CACHE = 'pocketstore-static-v8';
const DATA_CACHE = 'pocketstore-data-v8';
const API_URL = 'https://jsonplaceholder.typicode.com/users';

const MATCH_OPTIONS = { ignoreSearch: true, ignoreVary: true };

const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './favicon.ico',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// peticion con limite d tiempo
function fetchWithTimeout(request, ms) {
    return Promise.race([
        fetch(request),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms)
        )
    ]);
}

// guardar app shell
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const shellCache = await caches.open(STATIC_CACHE);

        for (const file of APP_SHELL) {
            try {
                await shellCache.add(file);
            } catch (error) {
                console.error('[Service Worker] No se pudo guardar:', file);
            }
        }
        console.log('[Service Worker] App Shell guardado en caché');

        try {
            const dataCache = await caches.open(DATA_CACHE);
            await dataCache.add(API_URL);
            console.log('[Service Worker] Datos iniciales guardados en caché');
        } catch (error) {
            console.warn('[Service Worker] No se pudieron guardar los datos iniciales');
        }
    })());
    self.skipWaiting();
});

// eliminar caches antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== STATIC_CACHE && key !== DATA_CACHE) {
                        console.log('[Service Worker] Eliminando caché antigua:', key);
                        return caches.delete(key);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

// fetch
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (url.hostname === 'jsonplaceholder.typicode.com') {
        event.respondWith(
            fetchWithTimeout(event.request, 4000)
                .then((networkResponse) => {
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(DATA_CACHE).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    console.log('[Service Worker] Sin red, usando datos en caché');
                    const cached = await caches.match(event.request, MATCH_OPTIONS);
                    if (cached) return cached;

                    return new Response(
                        JSON.stringify({ error: 'Sin conexión y sin datos guardados' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // cache first
    event.respondWith(
        caches.match(event.request, MATCH_OPTIONS).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html', MATCH_OPTIONS);
                }
                return new Response('No disponible sin conexión', { status: 503 });
            });
        })
    );
});