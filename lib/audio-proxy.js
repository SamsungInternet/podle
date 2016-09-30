/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const fileType = require('file-type');
const request = require('request');
const proxy = require('express-http-proxy');

module.exports = function (req, res) {
	let url = req.query.url;
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
					result.destroy();
					const type = fileType(chunk);
					type.url = result.request.uri.href;
					resolve(type);
				});
			});

			poke.on('error', reject);
		} else {
			throw Error('No url param!!!');
		}
	}).then(function (type) {
		if (type.mime.match(/^audio\//i)) {
			console.log('Proxying:', type.url, type);
			return proxy(type.url, {
				reqAsBuffer: true,
				timeout: 5000,
				forwardPath: function() {
					return require('url').parse(url).path;
				}
			})(req, res, function () {
				res.end('Request proxy timeout');
			});
		} else {
			throw Error('Filetype is not audio');
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