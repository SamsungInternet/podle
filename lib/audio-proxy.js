/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const fileType = require('file-type');
const proxy = require('express-http-proxy');

module.exports = function(req, res) {
	return new Promise(function() {
			if (req.query.url) {
				return proxy(req.query.url, {
					reqAsBuffer: true,
					timeout: 5000,
					forwardPath: function() {
						return require('url').parse(req.query.url).path;
					},
					intercept: function(rsp, data, req, res, callback) {

						if (!rsp.__mimeOkay && fileType(data).mime.match(/^audio\//i)) {
							rsp.__mimeOkay = true;
						} else {
							rsp.destroy();
							res.end('INVALID MIME TYPE');
						}
						callback(data);
					}
				})(req, res, function() {
					res.end('Request proxy timeout');
				});

			} else {
				throw Error('No url param!!!');
			}
		})
		.catch(function(err) {
			res.status(400);
			res.render('error', {
				message: err.message,
				layout: 'v1'
			});
		});
}