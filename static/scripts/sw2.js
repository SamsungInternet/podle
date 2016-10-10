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

function showSubscribeButton() {
	var p = document.createElement('div');
	p.textContent = 'Subscribe to push notifcations';
	p.classList.add('banner');
	document.querySelector('header').before(p);
	return new Promise(function (resolve) {
		p.addEventListener('click', function () {
			resolve(p);
		});
	});
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

	// Once per session update all the podcast subscriptions
	if (!sessionStorage.getItem('needs-update')) {
		sessionStorage.setItem('needs-update', '1');
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
					return {
						subscriptionId: subscription,
						rows: arr[0].rows
					}
				} else if (arr[0].total_rows) {

					// Has faved items but no subscription
					// reask for permission.
					return swPromise
						.then(function (reg) {
							return showSubscribeButton()
								.then(function (button) {
									button.remove();
								})
								.then(function () {
									return reg.pushManager.subscribe({ userVisibleOnly: true })
								})
								.then(function (subscriptionId) {
									return {
										subscriptionId: subscriptionId,
										rows: arr[0].rows
									};
								})
						});
				}
			})
			.then(function (o) {
				var subscriptionId = o.subscriptionId;
				var rows = o.rows;

				// Update server with correct info.
				// fetch from local db and update those urls
				return updateSubscription(rows.map(function (e) {
					return {
						url: e.id,
						subscriptionId: subscriptionId,
						unsubscribe: false
					};
				}));
			})
			.catch(function (e) {

				// Service workers not supported.
				console.log('service workers/push notifications not supported.')
				console.log(e);

				return false;
			});
	}

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
}