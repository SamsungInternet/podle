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
			const limit = req.query.max || 3;
			const omits = req.query.omit ? req.query.omit.split(',') : [];

			if (!shoudDebug) {
				items.items = items.items.slice(0, limit);
			}

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

app.listen(process.env.PORT || 3000);