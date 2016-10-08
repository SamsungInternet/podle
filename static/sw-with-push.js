/* global caches, Request, self, importScripts */
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
importScripts('/static/scripts/sw-push-notifications.js');
importScripts('/static/scripts/sw-routing.js');