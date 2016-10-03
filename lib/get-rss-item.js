/* eslint-env es6 */
/* eslint no-console: 0 */

'use strict';

const FeedParser = require('feedparser');
const moment = require('moment');
const URL = require('url');
const querystring = require('querystring');
const getStreamFromURL = require('./redis-connection').getStreamFromURL;

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

function pushNotification(url) {
	// fire a push notification to everyone listening
	console.log('Stub fire a pushnotification for ', url);
}

module.exports = function getRSSItem(url) {
	url = URL.parse(url);
	delete url.search;
	url.query = querystring.parse(url.query);
	url.query.format = 'xml';
	url.query.fmt = 'xml';
	url = URL.format(url);

	const feedparser = new FeedParser();

	return new Promise(function (resolve, reject) {
		const output = [];
		let meta;

		getStreamFromURL(url, 1800).then(({stream, fresh}) => {
			stream.pipe(feedparser);
			if (fresh) stream.on('end', () => pushNotification(url));
		});

		feedparser.on('error', function(error) {

			// always handle errors
			console.log('Feed Error:', error.message, url);
			reject(error);
		});

		feedparser.on('readable', function() {

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
				output.push(item);
			}
		});

		feedparser.on('meta', metadata => meta = metadata);

		feedparser.on('finish', function() {
			resolve({
				items: output,
				meta
			});
		});
	});
}