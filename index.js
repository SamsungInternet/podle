/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

require('dotenv').config();
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const qs = require('qs');
const getRSSItem = require('./lib/get-rss-item');
const getSearch = require('./lib/search');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const csp = require('helmet-csp');

app.set('json spaces', 2);
app.use(helmet());
app.use(csp({
	// Specify directives as normal.
	directives: {
		defaultSrc: ['\'self\'', 'http:', 'https:'],
		scriptSrc: ['\'self\'', '\'unsafe-inline\''],
		styleSrc: ['https://fonts.googleapis.com'],
		fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
		imgSrc: ['data:', 'https:'],
		sandbox: ['allow-forms', 'allow-scripts'],
		reportUri: '/report-violation',

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
		ifEq: function(a, b, options) { return (a === b) ? options.fn(this) : options.inverse(this); }
	}
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.get('/:version/search', function (req, res) {
	const shoudDebug = !!req.query.debug;
	getSearch(req.query.term)
	.then(function (result) {
		result.layout = req.params.version;
		res.render(shoudDebug ? 'search-debug' : 'search', result);
	})
	.catch(function (err) {
		res.status(400);
		res.render('error', {
			message: err.message,
			layout: req.params.version
		});
	});
});

app.get('/:version/feed', function (req, res) {
	if (req.query.url) {
		return getRSSItem(decodeURIComponent(req.query.url))
		.then(function (items) {
			const shoudDebug = !!req.query.debug;
			const shoudJson = !!req.query.json;
			const omits = req.query.omit ? req.query.omit.split(',') : [];

			if (omits.length) {
				items.items.forEach(item => {
					omits.forEach(key => {
						item[key] = undefined;
					});
				});
			}

			items.size = req.query.size || 'full';

			if (omits.indexOf('heading') > -1){
				delete items.meta.description;
			}

			items.items.forEach(item => {
				const urlParts = item.link.split('?');
			 	const params = qs.parse(urlParts[1]);
			 	item.link = `${urlParts[0]}?${qs.stringify(params)}`;
				return item;
			})

			items.layout = req.params.version;
			if (shoudJson) {
				return res.json(items);
			}
			res.render(shoudDebug ? 'feed-debug' : 'feed', items);
		}, function (err) {
			res.status(400);
			res.render('error', {
				message: err.message,
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

app.use(bodyParser.json({
	type: ['json', 'application/csp-report']
}));

app.post('/report-violation', function (req, res) {
	if (req.body) {
		console.log('CSP Violation: ', req.body)
	} else {
		console.log('CSP Violation: No data received!')
	}
	res.status(204).end()
});

app.listen(process.env.PORT || 3000);