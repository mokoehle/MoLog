/*
 * Ergänzung zum Service Worker (wird per importScripts eingebunden, siehe vite.config.ts):
 * zeigt die Push-Nachricht des Pausen-Timers an und öffnet die App beim Antippen.
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  // iOS verlangt, dass jede Push-Nachricht sichtbar angezeigt wird.
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pause vorbei', {
      body: data.body || '',
      tag: 'rest-timer',
      renotify: true,
      icon: 'icon-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0]
      return open ? open.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
