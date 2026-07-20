const CACHE_NAME = 'toolbox-cache-v8';

const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/firebase-init.js',
    './assets/icon.svg'
];

self.addEventListener('install', event => {
    // FORZA L'INSTALLAZIONE IMMEDIATA IGNORANDO QUELLO VECCHIO
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    // PRENDE IMMEDIATAMENTE IL CONTROLLO DELLA PAGINA APERTA
    event.waitUntil(clients.claim());

    // Elimina le vecchie cache
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('firestore') || event.request.url.includes('identitytoolkit') || event.request.url.includes('google.com')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
