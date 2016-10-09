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

	if (url.pathname === '/audioproxycache') {
		if (self.cacheAndNotifyDoNotSave) {
			const responsePromise = self.cacheAndNotifyDoNotSave(request);
			event.waitUntil(responsePromise)
			event.respondWith(responsePromise);
		}
	}

	if (request.url.match(/data:/i)) {
		// handle data uri
		return;
	}

	const responsePromise = handler(request, [], {
		networkTimeoutSeconds: 3
	});

	event.waitUntil(responsePromise)
	event.respondWith(responsePromise);
});