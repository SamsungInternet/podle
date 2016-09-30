/* eslint-env es6 */
/* eslint no-console: 0 */

'use strict';

const FeedParser = require('feedparser');
const request = require('request');
const moment = require('moment');
const URL = require('url');
const querystring = require('querystring');

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

		const req = request({
			url,
			followRedirect : true,
			headers : {
				'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
			}
		});

		req.on('error', function (error) {

			// handle any request errors
			console.log(error);
			reject('Request Error:', error);
		});

		req.on('response', function (res) {

			const stream = this;

			if (res.statusCode !== 200) {
				stream.destroy();
				return this.emit('error', new Error('Bad status code'));
			}

			stream.pipe(feedparser);
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