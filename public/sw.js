self.addEventListener('push', function(event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body || 'A student has started coding practice.',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                data: data.url || '/',
                requireInteraction: true,
                vibrate: [200, 100, 200]
            };
            
            event.waitUntil(
                self.registration.showNotification(data.title || 'Online Class Proctoring', options)
            );
        } catch (e) {
            console.error('Error parsing push data', e);
        }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.notification.data) {
        event.waitUntil(
            clients.openWindow(event.notification.data)
        );
    }
});
