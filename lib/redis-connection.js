/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const bluebird = require('bluebird');
const redis = require('redis');
const request = require('request');
const urlStoreNamepsace = 'url-store:0.0.1:';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

if (!process.env.REDIS_URL) {
	console.log('No redis!!');

	module.exports = {
		cache: {route: () => (req, res, next) => next()},
		redis: false
	}
} else {

	const redisSplit = require('redis-url').parse(process.env.REDIS_URL);
	require('redis-streams')(redis);
	const cache = require('express-redis-cache')({
		host: redisSplit.hostname, port: Number(redisSplit.port), auth_pass: redisSplit.password,
		expire: {
			'200': 5000,
			'4xx': 10,
			'403': 5000,
			'5xx': 10,
			'xxx': 1
		}
	});

	const client = redis.createClient({
		url: process.env.REDIS_URL,
		return_buffers: true
	});

	client.on('error', e => console.log ('Error' + e));

	function getStreamFromURL(url, ttl=0, forceFresh=false) {
		if (typeof url !== 'string') throw Error('Type of url is not string');

		return (forceFresh ? Promise.resolve(0) : client.existsAsync(urlStoreNamepsace + url))
		.then(exists => {
			if (exists) {

				console.log('Returning from cache:', url);
				return {
					fresh: false,
					stream: client.readStream(urlStoreNamepsace + url)
				};

			} else {
				return new Promise((resolve, reject) => {
					console.log('Getting fresh:', url);
					const req = request({
						url,
						followRedirect : true,
						headers : {
							'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
						}
					});

					req.on('error', function (error) {
						reject(error);
					});

					req.on('response', function (res) {

						const stream = this;

						if (res.statusCode !== 200) {
							stream.destroy();
							return this.emit('error', new Error('Bad status code'));
						}

						if (ttl) {
							stream.on('end', () => client.expireAsync(urlStoreNamepsace + url, ttl));
							resolve({
								fresh: true,
								stream: stream.pipe(client.writeThrough(urlStoreNamepsace + url))
							});
						} else {
							resolve({
								fresh: true,
								stream: stream
							});
						}
					});
				});
			}
		});
	}

	module.exports = {
		cache: cache,
		client: client,
		getStreamFromURL
	}
}