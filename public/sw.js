// Service Worker for Learnova PWA and Web Push Notifications
const CACHE_NAME = 'learnova-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active one
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip Supabase/external API calls
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If we got a valid response, clone it and save it to cache
        // Only cache basic type responses (our own assets)
        if (response && response.status === 200 && response.type === 'basic') {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // If network fails, try to get it from cache
        const matchedResponse = await caches.match(event.request);
        if (matchedResponse) {
          return matchedResponse;
        }

        // If it's a page navigation, fallback to index.html
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }

        // Fallback for everything else to avoid TypeError
        return new Response('Network error', {
          status: 408,
          statusText: 'Network error',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo.png', // Make sure you have a logo.png in public/
      badge: '/badge.png', // Optional
      data: {
        url: data.url || '/'
      },
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'View Details' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
