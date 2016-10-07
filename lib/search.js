/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';
const bluebird = require('bluebird');
const itunes = bluebird.promisify(require ('searchitunes'));
const redisClient = require('./redis-connection').client;
const searchKey = 'itunes-search:v0.0.1:';

module.exports = function (term) {
	if (!term) {
		return Promise.reject(Error('No search term'));
	}

	const params = {
		entity: 'podcast',
		term
	};

	return redisClient
	.getAsync(searchKey + term)
	.then(result => {
		if (result) {
			console.log('Returning cached search results: ' + term);
			let response;
			try {
				response = JSON.parse(result.toString());
				return response;
			} catch (e) {
				console.log('Error getting "' + term + '" from cache')
			}
		}
		console.log('Getting fresh search results: ' + term);
		return itunes(params)
			.then(function ({resultCount, results}) {
				results = results.map(result => ({
					url: result.feedUrl,
					text: result.collectionName || result.trackName,
					author: result.artistName
				}));

				return {
					resultCount,
					body: results
				}
			})
			.then(results => {
				return redisClient
				.setAsync(searchKey + term, JSON.stringify(results))
				.then(() => redisClient.expireAsync(searchKey + term, 3600 * 24 * 4))
				.then(() => results);
			});
	});
}
