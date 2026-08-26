const APP_VERSION = "v2.0.0";
const CACHE_NAME = `expense-tracker-${APP_VERSION}`;

const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icons/Gemini_Generated_Image_esra3nesra3nesra.png",
  "/firebase-config.js",
  "/firebase-init.js",
  "/firebase-sync.js",
  "/firebase-auth.js",
  "/firebase-migration.js",
  "/query-helper.js",
  "/chart.js",
  "/admin-view.html"
];

// 1. Install Event: Caches assets and removes old caches immediately
self.addEventListener("install", e => {
  console.log(`[Service Worker] Installing Version: ${APP_VERSION}`);
  
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[Service Worker] Caching all assets");
      return cache.addAll(urlsToCache);
    }).then(() => {
      // Delete old caches during install as requested
      return caches.keys().then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              console.log(`[Service Worker] Deleting old cache on install: ${key}`);
              return caches.delete(key);
            }
          })
        );
      });
    })
  );
  
  self.skipWaiting();
});

// 2. Activate Event: Takes control and reloads tabs
self.addEventListener("activate", e => {
  console.log(`[Service Worker] Activated Version: ${APP_VERSION}`);
  
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache on activate: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log("[Service Worker] Claiming clients");
      return self.clients.claim();
    }).then(() => {
      // Reload all tabs to force update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          if (client.url && "navigate" in client) {
            console.log(`[Service Worker] Reloading client: ${client.url}`);
            client.navigate(client.url);
          }
        });
      });
    })
  );
});

// 3. Fetch Event: Cache-First (Instant Loading) with Background Update for HTML
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  
  // EXCLUDE Firebase Auth reserved paths from SW interception
  // This is critical for Sign-in with Redirect to function correctly
  if (url.pathname.startsWith('/__/auth/')) {
    console.log(`[Service Worker] Bypassing Auth path: ${url.pathname}`);
    return;
  }

  // Strategy: Cache-First, then update cache in background
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      const fetchPromise = fetch(e.request).then(networkResponse => {
        // Only cache successful GET responses
        if (e.request.method === 'GET' && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, nothing to do (already serving from cache)
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Message Listener: Respond with version
self.addEventListener('message', event => {
  if (event.data === 'GET_VERSION') {
    console.log(`[Service Worker] Version requested. Responding with ${APP_VERSION}`);
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: APP_VERSION
    });
  }
});
