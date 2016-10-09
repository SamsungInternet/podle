/* global caches, Request, self, clients */
/* jshint browser:true */
/* eslint-env es6 */
'use strict';


self.cacheAndNotifyDoNotSave = function (request) {

	let u = new URL(request.url).search.match(/^\?url=(.+)/);
	if (u) {
		u = '/audioproxy?url=' + u;
	} else {
		return new Response('Invalid URL');
	}

	if (!(self.Notification && self.Notification.permission === 'granted')) {
		return;
	}

	if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
		console.warn('Notifications aren\'t supported.');
		return;
	}

	return self.registration.showNotification('Caching ' + u, {
		icon: 'https://podle.ada.is/static/icon192.png'
	})
	.then(event => {
		return cache(u).then(() => event.notification.close());
	})
	.then(() => {
		return self.registration.showNotification('Cached ' + u, {
			icon: 'https://podle.ada.is/static/icon192.png'
		});
	})
	.then(() => new Response('Cached Successfully'))
	.catch(e => {
		return self.registration.showNotification('Failed to Cache ' + u + ': ' + e.message, {
			icon: 'https://podle.ada.is/static/icon192.png'
		});
	});
}

function cache(url) {
	caches.open('push-notification-page-cache')
	.then(function(cache) {
      return cache.add(url);
    });
}

self.cacheUrl = cache;

function getPodleApiForFeed(url) {
	return ('/v7/feed?url=' + encodeURIComponent(url));
}

self.addEventListener('notificationclick', function(event) {
	event.notification.close();

	// This looks to see if the current is already open and
	// focuses if it is
	event.waitUntil(clients.matchAll({
		type: 'window'
	}).then(function(clientList) {
		for (const i = 0; i < clientList.length; i++) {
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
				return clients.openWindow(getPodleApiForFeed(event.notification.data.url));
			} else {
				return clients.openWindow('/');
			}
		};
	}));
});

self.addEventListener('push', function (event) {
	let message = 'One of your feeds has updated.';
	let data = {};
	let cachePromise = Promise.resolve();

	if (event.data) {
		try {
			data = event.data.json();
		} catch (e) {
			console.log('Push notification data parse failed data was ' + event.data.text())
		}
		if (data.title) {
			message = data.title + ' has been updated.';
		}
		if (data.url) {
			cachePromise = cache(getPodleApiForFeed(data.url));
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

	event.waitUntil(Promise.all([
		noti, cachePromise
	]));
});