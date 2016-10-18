/* global caches, Request, self, importScripts , toolbox*/
/* eslint no-console: 0 */
/* eslint-env es6 */
'use strict';


/**
 * A first pass through of the service worker
 *
 * It suppots offlining certain routes using sw-toolbox
 *
 * It has additional support for push notifications.
 */

importScripts('/static/scripts/third-party/sw-toolbox.js');


toolbox.precache([
	'/static/fonts/SamsungOne/SamsungOne-400.woff',
	'/static/fonts/SamsungOne/SamsungOne-700.woff',
	'https://ajax.googleapis.com/ajax/libs/webfont/1.6.16/webfont.js'
]);

importScripts('/static/scripts/sw-push-notifications.js');
importScripts('/static/scripts/sw-routing.js');