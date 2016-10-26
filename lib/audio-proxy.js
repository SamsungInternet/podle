/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const fileType = require('file-type');
const request = require('request');

const reqheaders = [
	'If-Range',
	'Range',
	'Accept'
];

const resheaders = [
	'Connection',
	'Accept-Ranges',
	'Content-Encoding',
	'Content-Language',
	'Content-Length',
	'Content-MD5',
	'Content-Range',
	'Content-Type',
	'Date',
	'Last-Modified',
	'ETag'
];

module.exports = function (req, res) {
	let url = req.query.url;
	if (url.match(/^https?%3A%2F%2F/i)) {
		url = decodeURIComponent(url);
	}
	return new Promise(function (resolve, reject) {
		const headersObj = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
		};
		for (const h of reqheaders) {
			if (req.headers[h.toLowerCase()]) headersObj[h] = req.headers[h.toLowerCase()];
		}
		if (url) {
			let needsCheck = true;
			const myReq = request({
				url: url,
				followRedirect : true,
				strictSSL: false,
				timeout: 5000,
				headersObj
			});

			myReq.on('response', function (response) {

				req.on('close', function () {
					console.log('Early termination of:', response.request.uri.href);
					myReq.abort();
					response.destroy();
				})

				req.on('end', function() {
					console.log('Stream finished?', response.request.uri.href);
					myReq.abort();
					response.destroy();
				})

				response.on('data', chunk => {

					if (needsCheck) {
						const type = fileType(chunk);
						if (
							type.mime.match(/^audio\//i) ||
							(headersObj.Range !== 'bytes=0-' && headersObj['Content-Type'].match(/^audio\//i))
						) {
							needsCheck = false;
							console.log('Proxying:', response.request.uri.href, type, headersObj.Range);
							res.set('Cache-Control', '91838874');
							const myHeaders = {};
							for (const h of resheaders) {
								if (response.headers[h.toLowerCase()]) {
									res.set(h, response.headers[h.toLowerCase()]);
									myHeaders[h] = response.headers[h.toLowerCase()];
								}
							}

							try {
								if (
									!response.headers['content-range'] &&
									response.headers['content-length'] &&
									headersObj.Range &&
									headersObj.Range !== 'bytes=0-' &&
									headersObj.Range.match(/^bytes=/)
								) {
									console.log('Calculating content-range');
									const [, a, b] = headersObj.Range.match(/^bytes=([^-]*)-(.*)/);
									const cR = 'bytes ' + a + '-' + (b || response.headers['content-length']) + '/' + response.headers['content-length'];
									console.log('Calculated content-range', cR);
									res.set('Content-Range', cR);
									myHeaders['Content-Range'] = cR;
								}
								res.status(200);
								// console.log('Setting Headers', myHeaders, 'from', response.headers);
								resolve();
							} catch (e) {
								console.log(e);
								reject(e);
							}

						} else {
							console.log('No mime match failing', headersObj);
							myReq.abort();
							response.destroy();
							throw Error(url + ' is not mime type audio');
						}
					}

					return res.write(chunk);
				});

				response.on('end', function() {
					res.end();
				});
			});

			myReq.on('error', reject);
		} else {
			throw Error('No url param!!!');
		}
	})
	.catch(function (err) {
		console.log(err);
		if (!res.headerSent) {
			res.status(400);
			res.render('error', {
				message: err.message,
				layout: 'v1'
			});
		}
	});
}