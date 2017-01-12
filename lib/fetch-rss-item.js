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
]

module.exports = function fetchRSSItem(url, fresh) {
	return new Promise((resolve, reject) => {
		request(`https://feed-service.herokuapp.com/feed?${fresh ? 'cb=' + Date.now() + '&' : ''}properties=${PROPERTIES.join(',')}&urls=${url}`, function callback(error, response, body) {
			if (error) reject(error);
			if (response.statusCode == 200) {
				resolve(body);
			} else {
				reject(Error(response.statusMessage + ': ' + body));
			}
		})
	})
}
