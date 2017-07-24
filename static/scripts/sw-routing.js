/* global caches, Request, self, toolbox */
/* jshint browser:true */
/* eslint-env es6 */
'use strict';

/**
 * A first pass through of the service worker
 *
 * It suppots offlining certain routes using sw-toolbox
 */

self.addEventListener('fetch', function (event) {
	const request = event.request;
	let handler = (request.url.match(/^http:\/\/localhost/) && location.protocol === 'http:' || location.hostname === 'localhost') ? toolbox.networkFirst : toolbox.fastest;
	const options = {
		networkTimeoutSeconds: 3
	};

	if (request.url.match(/(\.mp4|\.webm|\.avi|\.wmv|\.m4v|\.mp3|\.ogg|\.wma)$/i)) {
		// handle stream
		return;
	}

	const url = (new URL(request.url));

	// Straight to network here
	// once the /audioproxycache endpoint is finished
	// this will need to check for cache
	if (url.pathname === '/audioproxy') {
		return;
	}

	// In this case do the pushnotification cachy thing
	if (url.pathname === '/audioproxycache') {
		if (self.cacheAndNotifyDoNotSave) {
			const responsePromise = self.cacheAndNotifyDoNotSave(request);
			event.waitUntil(responsePromise)
			event.respondWith(responsePromise);
			return;
		}
	}

	// Let the api routes not be cached.
	// Ideally store for later on fail.
	if (url.pathname === '/sub' || url.pathname === '/unsub') {
		return;
	}

	// Let the api routes not be cached.
	// Ideally store for later on fail.
	if (url.pathname === '/v7/test-notification') {
		if (self.onPush) self.onPush({
			data: {
				json: function () {
					return {
						title: 'Test Notification',
						url: 'http://aliceisntdead.libsyn.com/rss'
					};
				}
			},
			waitUntil: function () {}
		});
		return event.respondWith(new Response('Hello World'));
	}

	// Ideally this would do cacheFirst then update the page if the
	// page has been updated
	if (url.pathname === '/v7/feed') {
		handler = toolbox.networkFirst;
	}

	// If it is CB then fetch with the cache buster query but store it In
	// the cache for the original url
	if (url.pathname === '/v7/feed' && url.search.match(/\&cb=/)) {
		const origUrl = request.url.replace(/&cb=[^&]*/gi, '');
		const responsePromise = Promise.all([
			fetch(request),
			caches.open('push-notification-page-cache')
		])
		.then(function([response, cache]) {
			if (!response.ok) {
				throw new TypeError('bad response status');
			}
			return cache.put(origUrl, response);
		})
		.then(function () {

			const headers = new Headers();
			headers.set('Content-Type', 'text/html');
			headers.set('Location', origUrl);

			return new Response(new Blob(), {
				'status': 301,
				'statusText': 'redirect',
				'headers': headers
			})
		});
		event.waitUntil(responsePromise)
		event.respondWith(responsePromise);
		return;
	}

	// Let data urls being handled normally
	if (request.url.match(/data:/i)) {
		// handle data uri
		return;
	}

	const responsePromise = handler(request, [], options);

	event.waitUntil(responsePromise)
	event.respondWith(responsePromise);
});