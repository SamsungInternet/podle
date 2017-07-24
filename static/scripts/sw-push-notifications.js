/* global caches, Request, self, clients */
/* jshint browser:true */
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
	.then(function (event) {
		return cache(u).then(function () { event.notification.close() });
	})
	.then(function () {
		return self.registration.showNotification('Cached ' + u, {
			icon: 'https://podle.ada.is/static/icon192.png'
		});
	})
	.then(function () {
		new Response('Cached Successfully');
	})
	.catch(function (e) {
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

function getPodleApiForFeed(urlIn, options) {
	options = options || {};

	let url = '/v7/feed?url=' + encodeURIComponent(urlIn);

	if (options.autoplay) {
		url += '&autoplay=' + options.autoplay;
	}

	return (url);
}

function getPodleApiForFirstFeedItem(url) {
	return ('/v7/latest-item-for-feed?url=' + encodeURIComponent(url));
}

self.onPush = function onpush(event) {
	let message = 'One of your feeds has updated.';
	let data = {};
	let networkPromise = Promise.resolve();
	let actions = [];

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
			const nextItemPromise = fetch(getPodleApiForFirstFeedItem(data.url))
				.then(function (response) {
					return response.json();
				})
				.catch(function () {
					// oh well ¯\_(ツ)_/¯	
					return {}
				});

			networkPromise = Promise.all([
				nextItemPromise,
				cache(getPodleApiForFeed(data.url))
			]);
			actions = [{
				action: 'play',
				title: '► Play Now'
			},{
				action: 'star',
				title:'★ Star'
			}];
		}
	}

	if (!(self.Notification && self.Notification.permission === 'granted')) {
		return;
	}

	if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
		console.warn('Notifications aren\'t supported.');
		return;
	}

	event.waitUntil(
		networkPromise
		.then(function (arr) {
			data.firstFeedItem = arr[0];

			return self.registration.showNotification('Podcast updated', {
				icon: 'https://podle.ada.is/static/icon192.png',
				badge: 'https://podle.ada.is/static/images/badge.png',
				data: data,
				body: message,
				actions: actions
			});
		})
	);
}

self.addEventListener('push', onpush);

self.addEventListener('notificationclick', function(event) {
	event.notification.close();

	const firstItem = event.notification.data.firstFeedItem;
	let autoplay = false;

	if (event.action === 'play') {
		autoplay = true;
	}

	if (event.action === 'star') {
		// Add to dm without opening page
		self.starItem(true, {

			// from views/feed.handlebars
			feedItemId: firstItem.feedItemId,
			title: firstItem.title,
			mediaUrl: firstItem.enclosures ? firstItem.enclosures.url : undefined,
		});
		return;
	}

	// This looks to see if the current is already open and
	// focuses if it is
	event.waitUntil(clients.matchAll({
		type: 'window'
	}).then(function(clientList) {

		autoplay = autoplay ? firstItem.feedItemId : false;

		// Find a focusable client and focus it
		for (const i = 0; i < clientList.length; i++) {
			const client = clientList[i];
			if ('focus' in client) {
				client.navigate(getPodleApiForFeed(event.notification.data.url, {autoplay: autoplay}));
				return client.focus();
			}
		}

		// couldn't focus client so open a new window
		if (clients.openWindow) {
			if (event.notification.data && event.notification.data.url) {
				return clients.openWindow(getPodleApiForFeed(event.notification.data.url, {autoplay: autoplay}));
			} else {
				return clients.openWindow('/');
			}
		};
	}));
});
