/* eslint-env es6 */
/* eslint no-console: 0 */

'use strict';

const FeedParser = require('feedparser');
const moment = require('moment');
const getStreamFromURL = require('./redis-connection').getStreamFromURL;
const redisClient = require('./redis-connection').client;
const {keys, urlToPretty, push} = require('./push-notifications');
const farmhash = require('farmhash');

function clean(o) {

	let out;

	if (typeof o === 'object' && o !== null) {
		let numberOfUsefulChildren = 0;
		let keys = Object.keys(o);
		for (const k of keys) {
			if (
				k.length > 1 ||
				typeof o[k] !== 'object' ||
				clean(o[k])
			) {
				numberOfUsefulChildren++;
				out = o[k];
				continue;
			}
		}
		if (numberOfUsefulChildren === 0) return false;
		if (numberOfUsefulChildren === 1) return out;
	}
	return o;
}

module.exports = function getRSSItem(url, forceFresh) {

	const redisKeyPart = urlToPretty(url);
	const redisTitleKey = keys.urlToTitleNamespace + redisKeyPart;
	const redisHashKey = keys.urlToHashNamespace + redisKeyPart;

	const feedparser = new FeedParser();

	return Promise.all([
		redisClient.getAsync(redisHashKey),
		getStreamFromURL(url, 1800, forceFresh)
	])
		.then(function ([hash, {stream}]) {

			if (hash) {
				hash = Number(hash.toString());
			} else {
				hash = false;
			}

			return new Promise(function (resolve, reject) {
				const output = [];
				let meta = {};

				stream.pipe(feedparser);

				feedparser.on('error', function (error) {

					// always handle errors
					console.log('Feed Error:', error.message, url);
					reject(error);
				});

				feedparser.on('readable', function () {

					// This is where the action is!
					const stream = this;
					let item;
					while (item = stream.read()) {
						if (item.date) {
							item.humanDate = moment(item.date).format('LLLL');
						}
						const keys = Object.keys(item);
						for (const k of keys) {
							const cleaned = clean(item[k]);
							if (cleaned === false) {
								delete item[k];
							} else {
								item[k] = cleaned;
							}
						}
						delete item.meta;
						output.push(item);
					}
				});

				feedparser.on('meta', metadata => meta = metadata);

				feedparser.on('finish', function () {

					const promises = [];

					meta.hash = farmhash.fingerprint32(JSON.stringify(output));

					if (meta.title) {
						promises.push(redisClient.setAsync(redisTitleKey, meta.title));
					}

					// Hash has changed so fire a push notification and update
					if (meta.hash !== hash) {
						push(url);
						promises.push(redisClient.setAsync(redisHashKey, meta.hash));
					}

					Promise.all(promises).then(() => {
						resolve({
							items: output,
							meta
						});
					});
				});
			})
		});
}