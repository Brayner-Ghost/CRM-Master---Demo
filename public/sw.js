const CACHE_NAME = 'crm-v1';
const STATIC_ASSETS_CACHE = 'crm-static-assets';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512.png'
];

// Instalação do Service Worker e precache dos arquivos principais
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching index and layout...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativação do Service Worker e limpeza de caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== STATIC_ASSETS_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições de rede
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Apenas interceptar requisições GET e esquemas http/https
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Ignorar chamadas da API do Firebase, Cloud Functions, Turnstile ou autenticação externa
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('challenges.cloudflare.com') ||
    url.pathname.includes('/emitirNfce') ||
    url.pathname.includes('/consultarNfceStatus') ||
    url.pathname.includes('/cancelarNfce')
  ) {
    return;
  }

  // 1. Estratégia de Navegação (Para URLs do SPA como /deals, /inventory)
  // Network-First, caindo para /index.html se offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        console.log('[Service Worker] Offline fallback triggered for navigation');
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 2. Estratégia Cache-First para recursos estáticos com hash (pasta /assets)
  // Como o Vite coloca hashes nos nomes dos arquivos (ex: index-B2z87x.js), se o arquivo mudar, seu nome muda.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(STATIC_ASSETS_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Estratégia Stale-While-Revalidate para outros arquivos locais (ícones, manifest, etc.)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_ASSETS_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        // Ignora falha silenciosamente caso offline
        console.log('[Service Worker] Silently ignored background fetch failure:', request.url);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
