/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const urlSubscribersNameSpace = 'url-subscribers:0.0.1:';
const listOfUrlsToCheckKey = 'urls-to-check:0.0.1';
const client = require('./redis-connection').client;

function follow(subscriptionId, url) {
	return client.saddAsync(urlSubscribersNameSpace + url, subscriptionId)
		.then(() => client.saddAsync(listOfUrlsToCheckKey, url));
}

function unFollow(subscriptionId, url) {
	return client.sremAsync(urlSubscribersNameSpace + url, subscriptionId)
		.then(() => client.scardAsync(urlSubscribersNameSpace + url))
		.then(count => {
			if (count === 0) {
				return client.sremAsync(listOfUrlsToCheckKey, url);
			}
		});
}

module.exports.keys = {
	listOfUrlsToCheckKey,
	urlSubscribersNameSpace
}
module.exports.follow = follow;
module.exports.unFollow = unFollow;