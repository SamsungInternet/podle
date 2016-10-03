/* global caches, Request, self, toolbox, importScripts */
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
	if (request.url.match(/data:/i)) {
		// handle data uri
		return;
	}
	event.respondWith(handler(request, [], {
		networkTimeoutSeconds: 3
	}));
});