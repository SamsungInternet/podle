/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

require('dotenv').config({silent: true});
Error.stackTraceLimit = Infinity;
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const fetchRSSItem = require('./lib/fetch-rss-item');
const getSearch = require('./lib/search');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const csp = require('helmet-csp');
const audioProxy = require('./lib/audio-proxy');
const querystring = require('querystring');
const URL = require('url');
const domain = require('domain');

app.set('json spaces', 2);
app.use(helmet());
app.use(csp({
	// Specify directives as normal.
	directives: {
		defaultSrc: ['\'self\'', 'http:', 'https:'],
		scriptSrc: ['\'self\'', 'cdn.polyfill.io', 'platform.twitter.com', 'ajax.googleapis.com/ajax/libs/webfont/', 'https://ssl.google-analytics.com/ga.js'],
		styleSrc: ['\'self\'', 'fonts.googleapis.com'],
		fontSrc: ['\'self\'', 'fonts.gstatic.com'],
		imgSrc: ['\'self\'', 'data:', 'https:'],
		// reportUri: '/api/report-violation',
		frameAncestors: ['\'none\''],

		objectSrc: [], // An empty array allows nothing through
	},

	// Set to true if you want to set all headers: Content-Security-Policy,
	// X-WebKit-CSP, and X-Content-Security-Policy.
	setAllHeaders: true,

	// Set to true if you want to disable CSP on Android where it can be buggy.
	disableAndroid: false,

	// Set to false if you want to disable any user-agent sniffing.
	// This may make the headers less compatible but it will be much faster.
	// This defaults to `true`. Should be false if behind cdn.
	browserSniff: false
}));

// Use Handlebars for templating
const hbs = exphbs.create({
	defaultLayout: 'v1',
	helpers: {
		ifEq: function(a, b, options) {
			return (a === b) ? options.fn(this) : options.inverse(this);
		},
		mangle: function(options) {
			return options.fn(this).replace(/[^a-z0-9]+/ig,'-');
		},
		bytesToMegabytes: function(options) {
			return (Number(options.fn(this)) / (1024 * 1024)).toFixed(2) + 'MB';
		},
		encodeURIComponent: function(options) {
			return encodeURIComponent(options.fn(this));
		}
	}
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

const d = domain.create();

d.on('error', function (err) {
	console.error('Error domain error: ', err.message, err.stack);
	process.exit(1);
});

d.run(function () {

	app.get('/audioproxy/', audioProxy);

	app.use('/static', express.static(__dirname + '/static', {
		maxAge: 3600 * 1000 * 24
	}));

	app.use('/sw-no-push.js', express.static(__dirname + '/static/sw-no-push.js'));
	app.use('/sw-with-push.js', express.static(__dirname + '/static/sw-with-push.js'));

	app.get('/', function (req, res) {
		res.redirect('/v7' + req.url || '/');
	});

	app.get('/feed', function (req, res) {
		res.redirect('/v7' + req.url || '/');
	});

	app.get('/search', function (req, res) {
		res.redirect('/v7' + req.url || '/');
	});

	app.use(bodyParser.json({
		type: ['json', 'application/csp-report']
	}));

	app.get('/:version/search', function (req, res) {
		const shouldDebug = !!req.query.debug;
		getSearch(req.query.term)
			.then(function (result) {
				result.layout = req.params.version;
				result.term = req.query.term;
				res.render(shouldDebug ? 'search-debug' : 'search', result);
			})
			.catch(function (err) {
				res.status(400);
				res.render('error', {
					term: req.query.term,
					message: err.message,
					layout: req.params.version
				});
			});
	});

	app.get('/:version/latest-item-for-feed', function (req, res) {
		if (req.query.url) {

			// Parse and add format querystrings
			let url = req.query.url;

			if (!url) return;

			const shouldDebug = !!req.query.debug;
			const shoudJson = !!req.query.json;
			const cacheBust = !!req.query.cb;
			return fetchRSSItem(unfungleUrl(url), shouldDebug || shoudJson || cacheBust)
				.then(function (feedData) {
					res.json(feedData.items.pop());
				});
		}
	});

	app.get('/:version/feed', function (req, res) {
		if (req.query.url) {

			// Parse and add format querystrings
			let url = req.query.url;
			if (url.match(/^https?%3A%2F%2F/i)) {
				url = decodeURIComponent(url);
			}

			let autoplay = false;
			if (req.query.autoplay) {
				autoplay = req.query.autoplay;
			}

			const shouldDebug = !!req.query.debug;
			const shoudJson = !!req.query.json;
			const cacheBust = !!req.query.cb;
			return fetchRSSItem(unfungleUrl(url), shouldDebug || shoudJson || cacheBust)
				.then(function (feedData) {

					feedData.url = url;

					if (autoplay) {
						feedData.autoplay = encodeURIComponent(autoplay);
					}

					feedData.items.forEach(item => {
						if (item.enclosures && !item['media:content']) {
							item['media:content'] = item.enclosures;
						}
					});

					feedData.items.reverse();

					feedData.layout = req.params.version;
					feedData.title = feedData.meta.title;
					if (shoudJson) {
						return res.json(feedData);
					}
					res.render(shouldDebug ? 'feed-debug' : 'feed', feedData);
				})
				.catch(function (err) {
					res.status(400);
					console.log(err);
					res.render('error', {
						message: err.message,
						url: url,
						layout: req.params.version,
					});
				});
		}
		res.status(400);
		res.render('error', {
			message: 'Invalid RSS URL',
			layout: req.params.version
		});
	});

	app.get('/:version/', function (req, res, next) {
		if (!req.params.version.match(/^v[0-9]+/)) {
			return next();
		}
		res.render('index', {
			layout: req.params.version
		});
	});

	function unfungleUrl(url, addFormat) {

		if (url.match(/^https?%3A%2F%2F/i)) {
			url = decodeURIComponent(url);
		}

		url = URL.parse(url);
		delete url.search;
		url.query = querystring.parse(url.query);
		if (addFormat) {
			url.query.format = 'xml';
			url.query.fmt = 'xml';
		}
		url = URL.format(url);

		return url;
	}

	app.post('/api/report-violation', function (req, res) {
		if (req.body && req.body['csp-report']) {
			console.log('CSP Violation: ', req.body['csp-report']['blocked-uri']);
		} else {
			console.log('CSP Violation: No data received!');
		}
		res.status(204).end();
	});
	app.listen(process.env.PORT || 3000);
});
