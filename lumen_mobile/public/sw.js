// lumen_mobile/public/sw.js
self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // Payload não-JSON/malformado: mostra notificação genérica em vez de estourar.
    data = {};
  }
  const title = data.title || 'Lumen+';
  const options = {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    // Sem tag fixo por tipo: evita que notificações do mesmo tipo se colapsem
    // silenciosamente (o usuário acreditava ter recebido só uma). Só agrupa se
    // o payload enviar um `tag` explícito — e nesse caso re-alerta (renotify).
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navega para o deep-link e só então foca (aguardado), evitando a
          // corrida em que o focus vence e o navigate se perde.
          return client.navigate(url).then(
            function (navigated) {
              return (navigated || client).focus();
            },
            function () {
              return client.focus();
            }
          );
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
