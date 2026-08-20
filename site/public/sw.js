/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */
const sw = self;

sw.addEventListener("push", (event) => {
	const { title, ...options } = event.data.json();
	event.waitUntil(sw.registration.showNotification(title, options));
});
