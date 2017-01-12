/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const request = require('request');

module.exports = function fetchRSSItem(term) {
	if (!term) {
		return Promise.reject(Error('No search term'));
	}

	return new Promise((resolve, reject) => {
		request(`https://feed-service.herokuapp.com/search?term=${term}`, function callback(error, response, body) {
			if (error) return reject(error);
			if (response.statusCode == 200) {
				resolve(JSON.parse(body));
			} else {
				reject(Error(response.statusMessage + ': ' + body));
			}
		})
	})
}
