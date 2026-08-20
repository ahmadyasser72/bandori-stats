/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */
const sw = self;

sw.addEventListener("push", (event) => {
	const { title, ...options } = event.data.json();
	event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const target = event.notification.navigate;
	if (!target) return;

	event.waitUntil(
		sw.clients.matchAll({ type: "window" }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === target && "focus" in client) return client.focus();
			}

			if (sw.clients.openWindow) return clients.openWindow(target);
		}),
	);
});
