/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';
const request = require('request');
const parseString = require('xml2js').parseString;

module.exports = function (term) {
	return new Promise(function (resolve, reject) {
		if (!term) {
			throw Error('No search term');
		}

		const url = 'http://api.digitalpodcast.com/v2r/search/?appid=' + process.env.DPSS + '&keywords=' + term;

		const req = request({
			url,
			followRedirect: true,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
			}
		});

		req.on('error', function (error) {

			// handle any request errors
			console.log('SEARCH API ERROR:', error);
			reject(error);
		});

		req.on('response', function (res) {

			const stream = this;

			if (res.statusCode >= 300) {
				return this.emit('error', new Error('Bad status code'));
			}

			let buffer = '';
			stream.on('data', function(data){
				const part = data.toString();
				buffer += part;
			});

			stream.on('end',function(){
				parseString(buffer, function (err, result) {
					if (err) return reject(err);
					result.opml.head = result.opml.head[0];
					result.opml.body = result.opml.body[0].outline;
					for (const k of Object.keys(result.opml.head)) {
						result.opml.head[k] = result.opml.head[k][0];
					}
					result.opml.body = result.opml.body.map(i => i['$']);
					resolve(result.opml);
				});
			});
		});
	});
}
