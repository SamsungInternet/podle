/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';
const parseString = require('xml2js').parseString;
const getStreamFromURL = require('./redis-connection').getStreamFromURL;

module.exports = function (term) {
	return new Promise(function (resolve, reject) {
		if (!term) {
			throw Error('No search term');
		}

		const url = 'http://api.digitalpodcast.com/v2r/search/?appid=' + process.env.DPSS + '&keywords=' + encodeURIComponent(term);

		 getStreamFromURL(url, 3600 * 24 * 30).then(({stream}) => {

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
					result.opml.body = result.opml.body ? result.opml.body.map(i => i['$']) : [];
					resolve(result.opml);
				});
			});
		});
	});
}
