/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const urlSubscribersNameSpace = 'url-subscribers:0.0.1:';
const urlToTitleNamespace = 'url-to-title:0.0.1:';
const urlToHashNamespace = 'url-to-hash:0.0.1:';
const listOfUrlsToCheckKey = 'urls-to-check:0.0.1';

const client = require('./redis-connection').client;
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
const URL = require('url');
const querystring = require('querystring');
const bluebird = require('bluebird');

if (process.env.GCMAPIKEY) {
	webpush.setGCMAPIKey(process.env.GCMAPIKEY);
	webpush.setVapidDetails(
	'mailto:ada@ada.is',
	vapidKeys.publicKey,
	vapidKeys.privateKey
	);
}

// TODO: Stagger this so it doesn't make many requests at once
function checkForUpdates() {
	const getRSSItem = require('./get-rss-item');
	console.log('About to check for updates.')
	client.smembersAsync(listOfUrlsToCheckKey)
		.then(urls => {
			console.log('Checking for updates for ' + urls.length + ' items');
			bluebird.coroutine(function *() {
				for (const url of urls) {
					yield getRSSItem(url.toString(), true).catch(e => console.log(e.message + ': ' + url));
					yield bluebird.delay(500);
				}
				console.log('Complete');
			})();
		});
}
setTimeout(checkForUpdates, 2000);
setInterval(checkForUpdates, 300 * 1000);

function follow(subscriptionId, url) {
	console.log('User following: ' + url);
	return client.saddAsync(urlSubscribersNameSpace + url, subscriptionId)
		.then(() => client.saddAsync(listOfUrlsToCheckKey, url));
}

function unFollow(subscriptionId, url) {
	console.log('User stopped following: ' + url);
	return client.sremAsync(urlSubscribersNameSpace + url, subscriptionId)
		.then(() => client.scardAsync(urlSubscribersNameSpace + url))
		.then(count => {
			if (count === 0) {
				return client.sremAsync(listOfUrlsToCheckKey, url);
			}
		});
}

function urlToPretty(urlIn) {
	let url = URL.parse(urlIn);
	delete url.search;
	url.query = querystring.parse(url.query);
	delete url.query.format;
	delete url.query.fmt;
	url = URL.format(url);
	return url;
}

function push(urlIn) {

	const url = urlToPretty(urlIn);
	let title = 'Podcast';

	return client.getAsync(urlToTitleNamespace + url)
		.then(titleIn => {
			if (titleIn) title = titleIn.toString();
		})
		.then(() => client.smembersAsync(urlSubscribersNameSpace + urlIn))
		.then(members => {
			const message = JSON.stringify({ url, title });
			console.log('Sending push notifications to followers of:', message);
			members.forEach(m => {
				let parsed;
				try {
					parsed = JSON.parse(m.toString());
				} catch (e) {
					console.log(e, m);
				}
				webpush.sendNotification(parsed, message);
			});
		})
		.catch(e => console.log(e));
}

module.exports.keys = {
	listOfUrlsToCheckKey,
	urlSubscribersNameSpace,
	urlToTitleNamespace,
	urlToHashNamespace
}
module.exports.follow = follow;
module.exports.unFollow = unFollow;
module.exports.push = push;
module.exports.urlToPretty = urlToPretty;
