/* eslint-env es6 */
/* eslint no-console: 0 */

'use strict';

const request = require('request');
const PROPERTIES = [
	'title',
	'media:content',
	'description',
	'link',
	'humanDate',
	'enclosures',
]

module.exports = function fetchRSSItem(url, fresh) {
	const newUrl = `https://feed-service.herokuapp.com/feed?meta=1&${fresh ? 'cb=' + Date.now() + '&' : ''}properties=${PROPERTIES.join(',')}&urls=${encodeURIComponent(url)}`;
	console.log(newUrl);
	return new Promise((resolve, reject) => {
		request({
				url: newUrl,
				proxy: process.env.http_proxy,
			}, 
			function callback(error, response, body) {
				if (error) reject(error);
				if (response.statusCode == 200) {
					resolve(JSON.parse(body));
				} else {
					reject(Error(response.statusMessage + ': ' + body));
				}
			}
		);
	})
	.then(function (data) {
		data.items.forEach(function (o) {
			o.feedItemId = encodeURIComponent(url) + '__' + o.title.replace(/[^a-z0-9]+/ig,'-');
		});
		
		return data;	
	});
}
