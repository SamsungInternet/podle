/* global caches, Request, self, importScripts, clients */
/* eslint no-console: 0 */
/* eslint-env es6 */
'use strict';


/**
 * A first pass through of the service worker
 *
 * It suppots offlining certain routes using sw-toolbox
 *
 * It has additional support for push notifications.
 */

importScripts('/static/scripts/third-party/sw-toolbox.js');
importScripts('/static/scripts/sw-routing.js');

self.addEventListener('notificationclick', function(event) {
	event.notification.close();

	// This looks to see if the current is already open and
	// focuses if it is
	event.waitUntil(clients.matchAll({
		type: 'window'
	}).then(function(clientList) {
		for (let i = 0; i < clientList.length; i++) {
			const client = clientList[i];
			if ('focus' in client) {
				if (event.notification.data && event.notification.data.url) {
					client.postMessage({
						action: 'update',
						url: event.notification.data
					});
				}
				return client.focus();
			}
		}

		// couldn't focus client so open a new window
		if (clients.openWindow) {
			if (event.notification.data && event.notification.data.url) {
				return clients.openWindow('/v7/feed?url=' + encodeURIComponent(event.notification.data.url));
			} else {
				return clients.openWindow('/');
			}
		};
	}));
});

self.addEventListener('push', function (event) {
	let message = 'One of your feeds has updated.';
	let data = {};

	if (event.data) {
		data = event.data.json();
		if (data.title) {
			message = data.title + ' has been updated.';
		}
	}

	if (!(self.Notification && self.Notification.permission === 'granted')) {
		return;
	}

	if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
		console.warn('Notifications aren\'t supported.');
		return;
	}

	const noti = self.registration.showNotification('Podcast updated', {
		icon: 'https://podle.ada.is/static/icon192.png',
		data: data,
		body: message
	});

	event.waitUntil(noti);
});