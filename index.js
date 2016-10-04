/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

require('dotenv').config({silent: true});
Error.stackTraceLimit = Infinity;
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const getRSSItem = require('./lib/get-rss-item');
const getSearch = require('./lib/search');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const csp = require('helmet-csp');
const audioProxy = require('./lib/audio-proxy');
const {follow, unFollow, push} = require('./lib/push-notifications');
const querystring = require('querystring');
const URL = require('url');

app.set('json spaces', 2);
app.use(helmet());
app.use(csp({
	// Specify directives as normal.
	directives: {
		defaultSrc: ['\'self\'', 'http:', 'https:'],
		scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.polyfill.io'],
		styleSrc: ['\'self\'', 'https://fonts.googleapis.com'],
		fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
		imgSrc: ['data:', 'https:'],
		// reportUri: '/api/report-violation',
		frameAncestors: ['none'],

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

app.get('/audioproxy/', audioProxy);

app.get('/:version/search', function(req, res) {
	const shoudDebug = !!req.query.debug;
	getSearch(req.query.term)
		.then(function(result) {
			result.layout = req.params.version;
			result.term = req.query.term;
			res.render(shoudDebug ? 'search-debug' : 'search', result);
		})
		.catch(function(err) {
			res.status(400);
			res.render('error', {
				term: req.query.term,
				message: err.message,
				layout: req.params.version
			});
		});
});

app.get('/:version/feed', function(req, res) {
	if (req.query.url) {

		// Parse and add format querystrings
		let url = req.query.url;
		if (url.match(/^https?%3A%2F%2F/i)) {
			url = decodeURIComponent(url);
		}

		return getRSSItem(url)
			.then(function(items) {
				const shoudDebug = !!req.query.debug;
				const shoudJson = !!req.query.json;

				items.size = req.query.size || 'full';
				items.url = url;

				items.items.forEach(item => {
					if (item.enclosures && !item['media:content']) {
						item['media:content'] = item.enclosures;
					}
				});

				items.layout = req.params.version;
				items.title = items.meta.title;
				if (shoudJson) {
					return res.json(items);
				}
				res.render(shoudDebug ? 'feed-debug' : 'feed', items);
			}, function(err) {
				res.status(400);
				res.render('error', {
					message: err.message,
					url: url,
					layout: req.params.version
				});
			});
	}
	res.status(400);
	res.render('error', {
		message: 'Invalid RSS URL',
		layout: req.params.version
	});
});

app.use('/sw-no-push.js', express.static(__dirname + '/static/sw-no-push.js'));
app.use('/sw-with-push.js', express.static(__dirname + '/static/sw-with-push.js'));

app.get('/:version/', function(req, res, next) {
	if (!req.params.version.match(/^v[0-9]+/)) {
		return next();
	}
	res.render('index', {
		layout: req.params.version
	});
});

app.get('/', function(req, res) {
	res.redirect('/v7/');
});

app.use(bodyParser.json({
	type: ['json', 'application/csp-report']
}));

function unfungleUrl(url) {

	if (url.match(/^https?%3A%2F%2F/i)) {
		url = decodeURIComponent(url);
	}

	url = URL.parse(url);
	delete url.search;
	url.query = querystring.parse(url.query);
	url.query.format = 'xml';
	url.query.fmt = 'xml';
	url = URL.format(url);

	return url;
}

app.post('/api/sub', function (req, res) {
	const url = req.body.url;
	const subscriptionId = req.body.subscriptionId;

	if (!url || !subscriptionId) {
		return res.status(400).json({
			message: 'Missing body items'
		});
	} else {
		follow(subscriptionId, unfungleUrl(url))
			.then(() => res.status(200).json({ status: 'ok' }))
			.catch(function(err) {
				res.status(400).json({
					message: err.message,
				});
			});
	}
});

app.post('/api/unsub', function (req, res) {
	const url = req.body.url;
	const subscriptionId = req.body.subscriptionId;

	if (!url || !subscriptionId) {
		return res.status(400).json({
			message: 'Missing body items'
		});
	} else {
		unFollow(subscriptionId, unfungleUrl(url))
			.then(() => res.status(200).json({ status: 'ok' }))
			.catch(function(err) {
				res.status(400).json({
					message: err.message,
				});
			});
	}
});

app.post('/api/push', function (req, res) {
	const url = req.body.url;

	if (!url) {
		return res.status(400).json({
			message: 'Missing body items'
		});
	} else {
		push(unfungleUrl(url))
			.then(() => res.status(200).json({ status: 'ok' }))
			.catch(function(err) {
				res.status(400).json({
					message: err.message,
				});
			});
	}
});

app.post('/api/report-violation', function(req, res) {
	if (req.body && req.body['csp-report']) {
		console.log('CSP Violation: ', req.body['csp-report']['blocked-uri'])
	} else {
		console.log('CSP Violation: No data received!')
	}
	res.status(204).end()
});

app.use('/static', express.static(__dirname + '/static', {
	maxAge: 3600*1000*24
}));

app.listen(process.env.PORT || 3000);
