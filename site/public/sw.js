/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */
const sw = self;

sw.addEventListener("push", (event) => {
	const { title, body } = event.data.json();
	event.waitUntil(sw.registration.showNotification(title, { body }));
});
