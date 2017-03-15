// Some extra nice ui interactions to make it seem more app like
/* eslint no-console: 0, no-var: 0 */
/* global serialize, Promise */
'use strict';

// Custom WebFonts
window.WebFontConfig = {
	custom: {
		families: ['Samsung One:n4,n7'],
		urls: ['/static/fonts/SamsungOne/fonts.css']
	}
};

(function(d) {
	var wf = d.createElement('script')
	var s = d.scripts[0];
	wf.src = 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.16/webfont.js';
	s.parentNode.insertBefore(wf, s);
} (document));

function isOk(response) {
	if (!response.ok) {
		return Promise.resolve(response)
			.then(getBody)
			.then(parse)
			.then(function (range) {
				var message = range.querySelector('#message');
				throw Error(message.textContent || ('Bad response: ' + response.statusText + ' (' + response.status + ')'));
			});
	}
	return response;
}

function curry2(fn) {
	return function (a, b) {
		if (b) {
			return fn(a, b);
		}
		return function (b) {
			return fn(a, b);
		}
	}
}

function getBody(response) {
	return response.text();
}

var parse = function getEl(body) {
	return document.createRange().createContextualFragment(body);
};

var replaceEl = curry2(function replaceEl(oldEl, newEl) {
	oldEl.innerHTML = '';
	return new Promise(function (resolve) {
		(function addItem() {
			if (newEl.firstChild) {
				if (newEl.firstChild.tagName === 'script') {
					newEl.removeChild(newEl.firstChild);
				} else {
					oldEl.appendChild(newEl.firstChild);
				}

				// Don't add large amounts at once'
				if (Math.random() < 0.3) {
					if (window.requestIdleCallback) {
						requestIdleCallback(addItem);
					} else {
						setTimeout(addItem, 16);
					}
				} else {
					addItem();
				}
			} else {
				resolve();
			}
		} ());
	});
});

function isLocal(url) {
	var a = document.createElement('a');
	a.href = url;
	var u = new URL(a.href);
	return u.origin === window.location.origin;
};

function showMessage(message) {

	var target = document.querySelector('.banner-area');
	if (!target) {
		var target = document.createElement('div');
		target.classList.add('banner-area');
		document.body.insertBefore(target, document.querySelector('header'));
	}

	var p = document.createElement('div');
	p.textContent = message;
	p.classList.add('banner');
	target.appendChild(p);
	return new Promise(function (resolve) {
		p.addEventListener('click', function () {
			resolve(p);
		});
	})
	.then(function () {
		target.removeChild(p);
	});
}

function debounce(dur, max, fn) {
	var oldTimeout = -1;
	var currentWait = 0;
	var fired = false;
	return function () {
		clearTimeout(oldTimeout);
		currentWait += dur;
		var self = this;
		if (currentWait > max) {
			currentWait = 0;
			fn.bind(self)();
		} else {
			oldTimeout = setTimeout(function () {
				currentWait = 0;
				fn.bind(self)();
			}, dur);
		}
	}
}

function checkForScroll() {
	if (this.scrollTop > 100) {
		document.querySelector('header').classList.add('mini');
	} else {
		document.querySelector('header').classList.remove('mini');
	}
}

function setUpMainContentEventListeners(el) {
	var scrollFn = debounce(50, 200, checkForScroll);
	el.addEventListener('scroll', scrollFn);
	el.addEventListener('touchstart', checkForScroll);
}

setUpMainContentEventListeners(document.querySelector('.main-content'));

function loadPage(url, pop) {

	var backwards = pop || window.location.href.indexOf(url) === 0;
	if (!pop && url === window.location.href) return;
	var oldMainEl = document.querySelector('main > div.main-content:not([data-used])');
	var main = document.querySelector('main');
	var titleEl = document.getElementsByTagName('title')[0];

	var newMainEl = document.createElement('div');
	newMainEl.classList.add('main-content');

	setUpMainContentEventListeners(newMainEl);

	if (!pop) {
		window.history.pushState({}, titleEl.textContent, url);
	}

	document.body.classList.add('loading');

	return new Promise(function (resolve) {

		var clearOldSlideTimeout;

		oldMainEl.dataset.used = '1';
		newMainEl.innerHTML = url.match(/\/feed\?url=/) ? DUMMY_CONTENT : LOADING_SPINNER;
		main.style.transition = '';

		// Only transition on mobile
		if (document.body.clientWidth < 600) {
			if (backwards) {
				main.insertBefore(newMainEl, main.firstChild);
				newMainEl.style.transform = 'translateX(-100%) translateX(-1rem)';
				oldMainEl.style.transform = 'translateX(-100%) translateX(-1rem)';
				main.style.transform = 'translateX(50%) translateX(1rem)';
			} else {
				main.appendChild(newMainEl);
				main.style.transform = 'translateX(-50%) translateX(-1rem)';
			}

			clearOldSlideTimeout = setTimeout(function () {
				oldMainEl.remove();
				newMainEl.style.transform = '';
				main.style.transition = 'none';
				main.style.transform = '';
			}, 1032);
		} else {
			oldMainEl.remove();
			main.appendChild(newMainEl);
		}

		var fetchPromise = fetch(url)
			.then(isOk)
			.then(getBody)
			.then(parse)
			.then(function (range) {
				var title = range.querySelector('title').textContent;
				var mainContent = range.querySelector('main > div.main-content') || range.querySelector('main');
				titleEl.textContent = title;
				window.history.replaceState({}, title, url);
				return mainContent;
			})
			.then(replaceEl(newMainEl))
			.catch(function (e) {
				console.log(e);
				showMessage(e.message + ', please try again later.');
				clearTimeout(clearOldSlideTimeout);

				if (window.history.state && window.history.state.loading) {
					window.history.back();
				}
			})
			.then(function () {
				return url;
			});

		resolve(fetchPromise);
	})
	.then(function () {
		var evt = document.createEvent("CustomEvent");
		evt.initCustomEvent('pageupdate', false, false, {
			url: url,
			main: newMainEl
		});
		document.body.dispatchEvent(evt);
	});
}

// Intercept local redirects and form submits to do it single page style and update the history
if (window.history.pushState && document.createRange) {
	function intercept(e) {
		var url;
		if (e.target.tagName === 'A' && e.type === 'click') url = e.target.href;
		if (e.target.tagName === 'FORM' && e.type === 'submit') url = e.target.action + '?' + serialize(e.target);

		if ( url && isLocal(url) ) {
			e.preventDefault();
			loadPage(url);
			if (!document.getElementById('hamburger').checked) document.getElementById('hamburger').click();
		}
	}

	document.body.addEventListener('submit', intercept);
	document.body.addEventListener('click', intercept);
	window.addEventListener('popstate', function () {
		loadPage(document.location.toString(), true);
	});
}

var LOADING_SPINNER = '<div class="spinner"><h2>Loading...</h2></div>';

var DUMMY_CONTENT = '<h1 class="feed-title feed-detail"><span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">████████</span></h1> <div><span class="filler">█</span> <button class="feed-item__meta-button-mark-all-as-read" title="Mark All"><span class="filler">████</span> <span class="filler">███</span></button> <button class="feed-item__meta-button-goto-first-unread" title="Goto First Item"><span class="filler">████</span> <span class="filler">█████</span> <span class="filler">████</span></button> <button class="feed-item__meta-button-goto-first-unread" title="Check for updates"><span class="filler">█████</span> <span class="filler">███</span> <span class="filler">███████</span></button> </div> <p class="description"><span class="filler">█████████████</span> <span class="filler">█████████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">█████████</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">█████████████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">█████████</span> <span class="filler">██████</span> <span class="filler">███████</span> <span class="filler">██████████</span> <span class="filler">██████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">████</span> <span class="filler">██████</span> <span class="filler">███████</span> <span class="filler">████</span> <span class="filler">██████████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">███████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">████</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">███████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">█████</span> <span class="filler">██</span> <span class="filler">██</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">█</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">█████████████</span> <span class="filler">█████████</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">█████████</span> <span class="filler">███████</span> <span class="filler">██</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">███████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">██</span> <span class="filler">███████████████</span></p> <p class="copyright"><span class="filler">█</span> <span class="filler">█████</span> <span class="filler">███████████</span> <span class="filler">█████</span></p> <div class="items"> <div class="feed-item"> <div class="feed-item__meta feed-item-detail"> <div class="feed-item__meta-button-area"><button title="Mark as Finished" class="feed-item__meta-button-finished"><span class="filler">████</span> <span class="filler">██</span> <span class="filler">████████</span></button> <button title="Add to List" class="feed-item__meta-button-add-to-list"><span class="filler">███</span> <span class="filler">██</span> <span class="filler">████</span></button></div> <h2 class="feed-item__meta-title"><span class="filler">████</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">█</span></h2> <time><span class="filler">███████</span> <span class="filler">█</span> <span class="filler">██████████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">████</span> <span class="filler">██</span></time> <p class="feed-item__meta-byline"><span class="filler">██</span> <span class="author"><span class="filler">███████████</span> <span class="filler">█████</span></span></p> </div> <div class="feed-item__audio-player"> <audio controls="" preload="none"> <span><a target="_blank" rel="noopener"><span class="filler">███</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">█</span> <span class="filler">█</span><span class="filesize"><span class="filler">████████</span></span> <span class="filler">███████████</span></span> </audio> <span><span class="filler">██</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">████</span> <br><span class="filler">███</span> <span class="filler">███</span> <a download="" target="_blank" rel="noopener" title="Direct Download: The Orbiting Human Circus (of the Air): Season One, Episode 1"><span class="filler">████████</span> <span class="filler">███████</span> <span class="filler">█████</span><br><span class="filler">█</span><span class="filesize"><span class="filler">███████</span></span> <span class="filler">███████████</span></span> </div> <p></p> <p><span class="filler">███████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██</span> <em><span class="filler">███</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span></em><span class="filler">█</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">█████████</span> <span class="filler">██████████</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">█████████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████</span></p> <p><span class="filler">████████</span> <span class="filler">████████</span> <span class="filler">█████████</span> <span class="filler">██</span> <em><span class="filler">███</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">████</span></em><span class="filler">█</span> <span class="filler">█████████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">███████</span> <span class="filler">█████████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">████</span> <span class="filler">████████</span> <span class="filler">████████████</span></p> <p><span class="filler">██████</span> <span class="filler">██</span> <span class="filler">██████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">██████████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">█████████████████████</span></p> <p><span class="filler">█████████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">██████</span> <span class="filler">██████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">█████████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">██</span> <span class="filler">████████████████████████████</span></p></div> </div> </main>';
