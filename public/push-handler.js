// Push Notification Handler for SUBASTANDOLO
// This file is imported by the generated service worker via importScripts

function getSoundForTag(tag) {
  switch (tag) {
    case 'admin_custom':
    case 'admin_notification':
    case 'promo':
    case 'announcement':
    case 'urgent':
    case 'maintenance':
      return '/sounds/administrador.mp3';
    case 'outbid':
      return '/sounds/sobrepuja.mp3';
    case 'new_bid':
      return '/sounds/pujando.mp3';
    case 'auction_won':
      return '/sounds/ganador.mp3';
    default:
      return '/sounds/campanita.mp3';
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'SUBASTANDOLO', body: event.data.text() };
  }

  const { title, body, url, tag, icon } = data;

  const options = {
    body: body || '',
    icon: icon || '/icons/notification-icon.png',
    badge: '/icons/notification-icon.png',
    tag: tag || 'subastandolo',
    data: { url: url || '/', soundUrl: getSoundForTag(tag || 'general') },
    requireInteraction: false,
    vibrate: [200, 100, 200],
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title || 'SUBASTANDOLO', options).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        const soundUrl = getSoundForTag(tag || 'general');
        for (const client of windowClients) {
          client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', soundUrl });
        }
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});