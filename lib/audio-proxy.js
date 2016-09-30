/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const fileType = require('file-type');
const request = require('request');

module.exports = function (req, res) {
	let url = req.query.url;
	let needsCheck = true;
	if (url.match(/^https?%3A%2F%2F/i)) {
		url = decodeURIComponent(url);
	}
	return new Promise(function (resolve, reject) {
		if (url) {
			const poke = request({
				url: url,
				followRedirect : true,
				headers : {
					'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
				}
			});

			poke.on('response', function (result) {
				result.once('data', chunk => {

					const type = fileType(chunk);
					if (needsCheck) {
						if (type.mime.match(/^audio\//i)) {
							needsCheck = false;
							console.log('Proxying:', type.url, type);
						} else {
							result.destroy();
							throw Error('Filetype is not audio');
						}
					}

					return res.write(chunk);
				});
			});

			poke.on('error', reject);
		} else {
			throw Error('No url param!!!');
		}
	})
	.catch(function (err) {
		res.status(400);
		res.render('error', {
			message: err.message,
			layout: 'v1'
		});
	});
}