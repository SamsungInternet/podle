'use strict';
/* eslint no-console: 0, no-var: 0 */
/* global PouchDB, Promise */

var swPromise;
var dbPodcasts = new PouchDB('podcastURLs');

function updateSubscription(subscription) {
	if (subscription.constructor === Array) {
		return Promise.all(subscription.map(function (s) {
			updateSubscription(s);
		}))
	}

	if (!subscription) return;

	var url = subscription.url;
	var subscriptionId = subscription.subscriptionId;
	var unsubscribe = subscription.unsubscribe;

	var endpoint = unsubscribe ? '/api/unsub' : '/api/sub';
	var jsonHeader = new Headers({
		'Content-Type': 'application/json',
		'Accept': 'application/json'
	});

	return fetch(endpoint, {
		method: 'POST',
		headers: jsonHeader,
		body: JSON.stringify({
			url: url,
			subscriptionId: JSON.stringify(subscriptionId)
		})
	})
	.then(function (response) {
		if (!response.ok) {
			return response.json().then(function (body) {
				console.error(body);
				throw Error('Bad Response');
			});
		}
	});
	// Make fetch request to update server
}

// Load the service worker which does not have push notification support.
if ('serviceWorker' in navigator) {
	swPromise = navigator.serviceWorker.register('/sw-with-push.js', { scope: '/' })
		.then(function (reg) {
			console.log('sw registered', reg);
			return reg;
		})
		.catch(function (error) {
			console.log('sw registration failed with ' + error);
			return false;
		})

	swPromise
		.then(function (reg) {
			return Promise.all([
				dbPodcasts.allDocs(),
				reg.pushManager.getSubscription()
			])
		})
		.then(function (arr) {
			var subscription = arr[1];
			if (subscription) {

				// Update server with correct info.
				// fetch from local db and update those urls
				return updateSubscription(arr[0].rows.map(function (e) {
					return {
						url: e.id,
						subscriptionId: subscription,
						unsubscribe: false
					};}));
			}
		})
		.catch(function (e) {

			// Service workers not supported.
			console.log('service workers/push notifications not supported.')
			console.log(e);

			return false;
		});

	(function () {

		function subscribe(url, unsubscribe) {
			console.log((unsubscribe ? 'Unsubscribing' : 'Subscribing') + ' to ' + url);

			swPromise
				.then(function (reg) {
					return reg.pushManager.subscribe({ userVisibleOnly: true })
				})
				.then(function (subscription) {
					return updateSubscription({ subscriptionId: subscription, url: url, unsubscribe: !!unsubscribe });
				})
				.catch(function (e) {
					if (Notification.permission === 'denied') {
						console.warn('Permission for Notifications was denied');
					} else {

						// A problem occurred with the subscription; common reasons
						// include network errors, and lacking gcm_sender_id and/or
						// gcm_user_visible_only in the manifest.
						console.error('Unable to subscribe to push.');
						console.log(e.message, e);
					}
				});
		}

		dbPodcasts.changes({
			since: 'now',
			live: true,
			include_docs: true
		}).on('change', function (e) {
			subscribe(e.id, e.deleted);
		});

		dbPodcasts.allDocs({
			include_docs: true
		}).then(function(result) {

			if (result.total_rows) {
				result.rows.forEach(function (row) {
					subscribe(row.id);
				});
			}
		});

	}());
}