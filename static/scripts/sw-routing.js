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
	const handler = (request.url.match(/^http:\/\/localhost/) && location.protocol === 'http:' || location.hostname === 'localhost') ? toolbox.networkFirst : toolbox.fastest;
	const options = {
		networkTimeoutSeconds: 3
	};

	if (request.url.match(/(\.mp4|\.webm|\.avi|\.wmv|\.m4v|\.mp3|\.ogg|\.wma)$/i)) {
		// handle stream
		return;
	}

	const url = (new URL(request.url));
	if (url.pathname === '/audioproxy') {
		return;
	}

	// Let the api routes not be cached.
	// Ideally store for later on fail.
	if (url.pathname === '/sub' || url.pathname === '/unsub') {
		return;
	}

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

	if (url.pathname === '/audioproxycache') {
		if (self.cacheAndNotifyDoNotSave) {
			const responsePromise = self.cacheAndNotifyDoNotSave(request);
			event.waitUntil(responsePromise)
			event.respondWith(responsePromise);
			return;
		}
	}

	if (request.url.match(/data:/i)) {
		// handle data uri
		return;
	}

	const responsePromise = handler(request, [], options);

	event.waitUntil(responsePromise)
	event.respondWith(responsePromise);
});