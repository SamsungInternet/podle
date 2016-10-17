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
				throw Error('Bad response: ' + (message.textContent || response.statusText) + ' (' + response.status + ')');
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

var parse =function getEl(body) {
	return document.createRange().createContextualFragment(body);
};

var replaceEl = curry2(function replaceEl(oldEl, newEl) {
	oldEl.innerHTML = '';
	while (newEl.firstChild) {
		if (newEl.firstChild.tagName === 'script') {
			newEl.removeChild(newEl.firstChild);
			return;
		}
		oldEl.appendChild(newEl.firstChild);
	}
	newEl.remove();
	return newEl;
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

var loading = false;
function loadPage(url, replace, backwards) {
	if (!replace && url === window.location.href || loading) return;
	var backwards = backwards || (replace === true) || window.location.href.indexOf(url) === 0;
	var oldMainEl = document.querySelector('main:not([data-used])');
	var newMainEl = document.createElement('main');
	var footer = document.querySelector('footer');
	loading = true;
	document.body.classList.add('loading');

	return new Promise(function (resolve) {
		var titleEl = document.getElementsByTagName('title')[0];
		newMainEl.innerHTML = url.match(/\/feed\?url=/) ? DUMMY_CONTENT : LOADING_SPINNER;
		document.body.insertBefore(newMainEl, footer);

		newMainEl.style.transform = 'translateX(' + (backwards ? '-' : '') + '100vw)';
		newMainEl.style.position = 'absolute';
		newMainEl.style.left = oldMainEl.offsetLeft + 'px';
		newMainEl.style.top = oldMainEl.offsetTop + 'px';
		newMainEl.style.width = oldMainEl.offsetWidth + 'px';
		newMainEl.style.height = oldMainEl.offsetHeight + 'px';

		oldMainEl.getBoundingClientRect();
		newMainEl.style.transform = '';
		oldMainEl.style.transform = 'translateX(' + (!backwards ? '-' : '') + '100vw)';
		oldMainEl.dataset.used = '1';

		// flush again
		oldMainEl.getBoundingClientRect();
		var clearOldSlideTimeout = clearOldSlideTimeout = setTimeout(function () {
			oldMainEl.remove();
			newMainEl.style.position = '';
			newMainEl.style.left = '';
			newMainEl.style.top = '';
			newMainEl.style.width = '';
			newMainEl.style.height = '';
		}, 1000);

		var fetchPromise = fetch(url)
			.then(isOk)
			.then(getBody)
			.then(parse)
			.then(function (range) {
				var title = range.querySelector('title').textContent;
				var main = range.querySelector('main');
				titleEl.textContent = title;
				if (replace !== true) window.history.pushState({}, title, url);
				return main;
			})
			.then(replaceEl(newMainEl))
			.catch(function (e) {
				console.log(e);
				showMessage('Failed to load, ' + e.message + ', please try again later.');
				clearTimeout(clearOldSlideTimeout);
				delete oldMainEl.dataset.used;
				newMainEl.remove();
				oldMainEl.style.transform = '';
			})
			.then(function () {
				return url;
			});

		resolve(fetchPromise);
	})
	.then(function () {
		loading = false;
		document.body.classList.remove('loading');
		document.body.dispatchEvent(new CustomEvent('pageupdate', { url: url }));
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

var LOADING_SPINNER = '<div class="spinner">Loading...</div>';

var DUMMY_CONTENT = '<h1 class="feed-title feed-detail"><span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">████████</span></h1> <div><span class="filler">█</span> <button class="feed-item__meta-button-mark-all-as-read" title="Mark All"><span class="filler">████</span> <span class="filler">███</span></button> <button class="feed-item__meta-button-goto-first-unread" title="Goto First Item"><span class="filler">████</span> <span class="filler">█████</span> <span class="filler">████</span></button> <button class="feed-item__meta-button-goto-first-unread" title="Check for updates"><span class="filler">█████</span> <span class="filler">███</span> <span class="filler">███████</span></button> </div> <p class="description"><span class="filler">█████████████</span> <span class="filler">█████████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">█████████</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">█████████████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">█████████</span> <span class="filler">██████</span> <span class="filler">███████</span> <span class="filler">██████████</span> <span class="filler">██████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">████</span> <span class="filler">██████</span> <span class="filler">███████</span> <span class="filler">████</span> <span class="filler">██████████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">███████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">████</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">███████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">█████</span> <span class="filler">██</span> <span class="filler">██</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">█</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">█████████████</span> <span class="filler">█████████</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">█████████</span> <span class="filler">███████</span> <span class="filler">██</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">███████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">██</span> <span class="filler">███████████████</span></p> <p class="copyright"><span class="filler">█</span> <span class="filler">█████</span> <span class="filler">███████████</span> <span class="filler">█████</span></p> <div class="items"> <div class="feed-item"> <div class="feed-item__meta feed-item-detail"> <div class="feed-item__meta-button-area"><button title="Mark as Finished" class="feed-item__meta-button-finished"><span class="filler">████</span> <span class="filler">██</span> <span class="filler">████████</span></button> <button title="Add to List" class="feed-item__meta-button-add-to-list"><span class="filler">███</span> <span class="filler">██</span> <span class="filler">████</span></button></div> <h2 class="feed-item__meta-title"><span class="filler">████</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">█</span></h2> <time><span class="filler">███████</span> <span class="filler">█</span> <span class="filler">██████████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">████</span> <span class="filler">██</span></time> <p class="feed-item__meta-byline"><span class="filler">██</span> <span class="author"><span class="filler">███████████</span> <span class="filler">█████</span></span></p> </div> <div class="feed-item__audio-player"> <audio controls="" preload="none"> <span><a target="_blank" rel="noopener"><span class="filler">███</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">█</span> <span class="filler">█</span><span class="filesize"><span class="filler">████████</span></span> <span class="filler">███████████</span></span> </audio> <span><span class="filler">██</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">████</span> <br><span class="filler">███</span> <span class="filler">███</span> <a download="" target="_blank" rel="noopener" title="Direct Download: The Orbiting Human Circus (of the Air): Season One, Episode 1"><span class="filler">████████</span> <span class="filler">███████</span> <span class="filler">█████</span><br><span class="filler">█</span><span class="filesize"><span class="filler">███████</span></span> <span class="filler">███████████</span></span> </div> <p></p> <p><span class="filler">███████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██</span> <em><span class="filler">███</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span></em><span class="filler">█</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">█████████</span> <span class="filler">██████████</span> <span class="filler">█████</span> <span class="filler">████</span> <span class="filler">█████████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">██</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████</span></p> <p><span class="filler">████████</span> <span class="filler">████████</span> <span class="filler">█████████</span> <span class="filler">██</span> <em><span class="filler">███</span> <span class="filler">████████</span> <span class="filler">█████</span> <span class="filler">██████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">████</span></em><span class="filler">█</span> <span class="filler">█████████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">███████</span> <span class="filler">█████████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">████</span> <span class="filler">████████</span> <span class="filler">████████████</span></p> <p><span class="filler">██████</span> <span class="filler">██</span> <span class="filler">██████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">███████</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">██████████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">██████</span> <span class="filler">████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">███████</span> <span class="filler">███</span> <span class="filler">███</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████</span> <span class="filler">█████</span> <span class="filler">███</span> <span class="filler">██████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">█████████████████████</span></p> <p><span class="filler">█████████</span> <span class="filler">████</span> <span class="filler">███████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">██████</span> <span class="filler">██████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">████████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">█████████</span> <span class="filler">██</span> <span class="filler">███</span> <span class="filler">█████████</span> <span class="filler">███</span> <span class="filler">████</span> <span class="filler">████████</span> <span class="filler">██</span> <span class="filler">██</span> <span class="filler">████████████████████████████</span></p></div> </div> </main>';
