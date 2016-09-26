/* eslint-env es6 */
/* eslint no-console: 0 */

'use strict';

const FeedParser = require('feedparser')
const request = require('request');
const moment = require('moment');

module.exports = function getRSSItem(url) {
	const req = request({
		url,
		followRedirect : true,
		headers : {
			'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
		}
	});
	const feedparser = new FeedParser();

	return new Promise(function (resolve, reject) {
		const output = [];
		let meta;

		req.on('error', function (error) {

			// handle any request errors
			debug(error);
			reject(error);
		});

		req.on('response', function (res) {

			const stream = this;

			if (res.statusCode !== 200) {
				return this.emit('error', new Error('Bad status code'));
			}

			stream.pipe(feedparser);
		});


		feedparser.on('error', function(error) {

			// always handle errors
			console.log(error);
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