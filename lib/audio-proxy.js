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
			const myReq = request({
				url: url,
				followRedirect : true,
				headers : {
					'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
				}
			});

			myReq.on('response', function (result) {
				result.on('data', chunk => {

					if (needsCheck) {
						const type = fileType(chunk);
						if (type.mime.match(/^audio\//i)) {
							needsCheck = false;
							console.log('Proxying:', url, type);
							res.set('Content-Type', type.mime);
							res.status(200);
						} else {
							result.destroy();
							throw Error('Filetype is not audio');
						}
					}

					return res.send(chunk);
				});
			});

			myReq.on('error', reject);
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