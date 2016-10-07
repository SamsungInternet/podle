/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const fileType = require('file-type');
const request = require('request');

module.exports = function (req, res) {
	let url = req.query.url;
	if (url.match(/^https?%3A%2F%2F/i)) {
		url = decodeURIComponent(url);
	}
	return new Promise(function (resolve, reject) {
		if (url) {
			let needsCheck = true;
			const myReq = request({
				url: url,
				followRedirect : true,
				headers : {
					'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
				}
			});

			myReq.on('response', function (result) {

				req.on('close', function () {
					console.log('Early termination of:', result.request.uri.href);
					myReq.abort();
					result.destroy();
				})

				req.on('end', function() {
					console.log('Stream finished?', result.request.uri.href);
					myReq.abort();
					result.destroy();
				})

				result.on('data', chunk => {

					if (needsCheck) {
						const type = fileType(chunk);
						if (type.mime.match(/^audio\//i)) {
							needsCheck = false;
							console.log('Proxying:', result.request.uri.href, type);
							res.set('Content-Type', type.mime);
							res.status(200);
							console.log('Set the good headers');
						} else {
							result.destroy();
							res.end(url + ' is not mime type audio');
							return console.log(url + ' is not mime type audio');
						}
					}

					return res.write(chunk);
				});

				result.on('end', function() {
					res.end();
					resolve();
				});
			});

			myReq.on('error', reject);
		} else {
			throw Error('No url param!!!');
		}
	})
	.catch(function (err) {
		if (!res.headerSent) {
			res.status(400);
			res.render('error', {
				message: err.message,
				layout: 'v1'
			});
		} else {
			console.log(err);
		}
	});
}