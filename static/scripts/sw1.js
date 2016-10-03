'use strict';

// Load the service worker which does not have push notification support.
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/sw-no-push.js', { scope: '/' })
	.then(function(reg) {
		console.log('sw registered', reg);
	}).catch(function(error) {
		console.log('sw registration failed with ' + error);
	});
}

