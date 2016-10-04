/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const urlSubscribersNameSpace = 'url-subscribers:0.0.1:';
const listOfUrlsToCheckKey = 'urls-to-check:0.0.1';
const client = require('./redis-connection').client;
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
const URL = require('url');
const querystring = require('querystring');

webpush.setGCMAPIKey(process.env.GCMAPIKEY);
webpush.setVapidDetails(
  'mailto:ada@ada.is',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

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

function push(urlIn) {
	console.log('Sending push notifications to followers of ' + urlIn);
	let url = URL.parse(urlIn);
	delete url.search;
	url.query = querystring.parse(url.query);
	delete url.query.format;
	delete url.query.fmt;
	url = URL.format(url);

	let title = 'Podcast';

	return client.smembersAsync(urlSubscribersNameSpace + urlIn)
		.then(members => {
			members.forEach(m => {
				let parsed;
				try {
					parsed = JSON.parse(m.toString());
				} catch (e) {
					console.log(e, m);
				}
				webpush.sendNotification(parsed, JSON.stringify({ url, title }));
			});
		})
		.catch(e => console.log(e));
}

module.exports.keys = {
	listOfUrlsToCheckKey,
	urlSubscribersNameSpace
}
module.exports.follow = follow;
module.exports.unFollow = unFollow;
module.exports.push = push;
