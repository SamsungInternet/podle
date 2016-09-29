/* eslint no-var:0 */
/* global PouchDB, Set */
'use strict';

var dbPodcasts = new PouchDB('podcastURLs');
var dbPodcastItems = new PouchDB('podcastItems');

var handleErr = function(e) {
	console.log(e);
}

function finishedWith(e) {
	var feed = e.target.dataset.feedId;
	var id = e.target.dataset.feedItemId;
	var action = e.target.dataset.action;
	return dbPodcasts.get(feed).then(function (doc) {
		if (
			action === 'finish' &&
			doc.read.indexOf(id) === -1
		) {
			doc.read.push(id);
		}
		if (action === 'unfinish') {
			doc.read = doc.read.filter(function (a) {
				a !== id;
			});
		}
		return dbPodcasts.put(doc);
	});
}

function onAddToList(e) {
	var doc = {
		_id: e.target.dataset.feedItemId,
		type: 'feed-item',
		title: e.target.dataset.title
	};
	if (e.target.dataset.action === 'list') dbPodcastItems
		.put(doc)
		.catch(handleErr);
	if (e.target.dataset.action === 'unlist') dbPodcastItems
		.get(doc._id).then(removeDoc)
		.then(dbPodcastItems.put.bind(dbPodcastItems))
		.catch(handleErr);
}

function addFeedItemButtons(item, read, listed) {
	if (!item) throw Error('No el for the buttons');
	var tempButton;

	var feedId = item.dataset.feed;
	var feedItemId = item.dataset.feedItemId;
	var title = item.dataset.title;

	var oldBox = item.querySelector('.feed-item__meta-button-area');
	if (oldBox) item.removeChild(oldBox);

	var buttonArea = document.createElement('div');
	buttonArea.classList.add('feed-item__meta-button-area');

	if (oldBox) {
		read = typeof read === 'boolean' ? read : (oldBox.querySelector('.feed-item__meta-button-finished').dataset.action === 'unfinish');
		listed = typeof listed === 'boolean' ? listed : (oldBox.querySelector('.feed-item__meta-button-add-to-list').dataset.action === 'unlist');
	}

	tempButton = document.createElement('button');
	tempButton.addEventListener('click', finishedWith);
	tempButton.dataset.action = read ? 'unfinish' : 'finish';
	tempButton.dataset.feedId = feedId;
	tempButton.dataset.feedItemId = feedItemId;
	tempButton.textContent = read ? 'Mark as Unfinished' : 'Mark as Finished';
	tempButton.classList.add('feed-item__meta-button-finished');
	buttonArea.appendChild(tempButton);

	tempButton = document.createElement('button');
	tempButton.addEventListener('click', onAddToList);
	tempButton.dataset.action = listed ? 'unlist' : 'list';
	tempButton.dataset.feedItemId = feedItemId;
	tempButton.dataset.title = title;
	tempButton.textContent = listed ? 'Remove from List' : 'Add to List';
	tempButton.classList.add('feed-item__meta-button-add-to-list');
	buttonArea.appendChild(tempButton);

	item.appendChild(buttonArea);
};

function removeDoc(doc) {
	doc._deleted = true;
	return doc;
}

function onAddToMyPodcasts(e) {
	var doc = {
		_id: e.target.dataset.url,
		type: 'feed',
		title: e.target.dataset.name,
		url: e.target.dataset.url,
		read: []
	};
	if (e.target.dataset.action === 'add') dbPodcasts
		.put(doc)
		.catch(handleErr);
	if (e.target.dataset.action === 'remove') dbPodcasts
		.get(doc._id).then(removeDoc)
		.then(dbPodcasts.put.bind(dbPodcasts))
		.catch(handleErr);
}

function addFeedButton(el, isSaved) {
	if (typeof isSaved !== 'boolean') throw Error('Is saved needs to be boolean');

	var classname = 'feed-item__meta-button-add-remove-to-my-podcasts';

	var button = el.querySelector('.' + classname);
	if (button) {

		if (isSaved === false) {
			if (button.dataset.action !== 'remove') return;
		} else {
			if (button.dataset.action !== 'add') return;
		}

		var action = isSaved === true ? 'remove' : 'add';
		button.textContent = isSaved === true ? 'Remove from my podcasts' : 'Add to my podcasts';
		button.dataset.action = action;
	} else {

		if (!el) return;
		button = document.createElement('button');
		button.addEventListener('click', onAddToMyPodcasts);
		button.classList.add(classname);
		button.dataset.url = el.dataset.url;
		button.dataset.name = el.dataset.name;
		var action = isSaved === true ? 'remove' : 'add';
		button.textContent = isSaved === true ? 'Remove from my podcasts' : 'Add to my podcasts';
		button.dataset.action = action;
		el.appendChild(button);
	}
};

var safeString = (function () {
	var div = document.createElement('div');

	function safeString(a) {
		div.textContent = a;
		return div.innerHTML;
	}

	return safeString;
} ());

function updateAllPodcastUI() {
	return dbPodcasts.allDocs({
		include_docs: true
	}).then(function(result) {
		var listHTML = '';
		var addFeedTargets = new Set(document.querySelectorAll('.feed-detail'));
		var finishedWith = [];

		if (result.total_rows) {
			result.rows.forEach(function (row) {
				listHTML += '<li class="feed-detail" data-url="' + safeString(row.id) +'" data-name="' + safeString(row.doc.title) +'"><a href="feed?url=' + safeString(row.id) + '">' + safeString(row.doc.title) + '</a></li>';
				var matches = Array.from(document.querySelectorAll('.feed-detail[data-url="' + safeString(row.id) + '"]'));

				matches.forEach(function(el) {
					addFeedButton(el, true);
					addFeedTargets.delete(el);
				});

				finishedWith.push.apply(finishedWith, row.doc.read);
			});
		}

		// Add buttons to everything not in db
		Array.from(addFeedTargets).forEach(function(el) {
			addFeedButton(el, false);
		});

		Array.from(document.querySelectorAll('.my-podcasts')).forEach(function(ul) {
			ul.innerHTML = listHTML;
			Array.from(ul.childNodes).forEach(function (el) {
				addFeedButton(el, true);
			});
		});

		return finishedWith;
	});
}

function updatePodcastItemsUI(readItems) {

	return dbPodcastItems.allDocs({
		include_docs: true
	}).then(function (result) {

		var listHTML = '';
		var listed = result.rows.map(function (row) {

			var feedUrl = safeString(row.id).split('__');
			var hash = feedUrl.pop();
			feedUrl = feedUrl.join('__');

			listHTML += '<li class="feed-item-detail" data-feed-item-id="' + safeString(row.id) +'" data-title="' + safeString(row.doc.title) +'" data-feed="' + feedUrl + '"><a href="feed?url=' + feedUrl + '#' + hash + '">' + safeString(row.doc.title) + '</a></li>';
			return row.id;
		});

		var items = Array.from(document.getElementsByClassName('feed-item-detail'));
		items.forEach(function (el) {
			addFeedItemButtons(el,
				readItems.includes(el.dataset.feedItemId),
				listed.includes(el.dataset.feedItemId)
			);
		});

		Array.from(document.querySelectorAll('.saved-for-later'))
		.forEach(function(ul) {
			ul.innerHTML = listHTML;
			Array.from(ul.childNodes).forEach(function (el) {
				addFeedItemButtons(el, readItems.includes(el.dataset.feedItemId), true);
			});
		});
	});
}

window.addEventListener('load', function() {

	dbPodcastItems.changes({
		since: 'now',
		live: true
	}).on('change', function (e) {
		Array.from(document.querySelectorAll('.feed-item-detail[data-feed-item-id="' + safeString(e.id) + '"]'))
			.forEach(function (target) {
				addFeedItemButtons(target, undefined, !e.deleted);
			});
	});

	dbPodcasts.changes({
		since: 'now',
		live: true,
		include_docs: true
	}).on('change', function (e) {
		Array.from(document.querySelectorAll('.feed-detail[data-url="' + safeString(e.id) + '"]'))
			.forEach(function (target) {
				addFeedButton(target, !e.deleted);
			});
		Array.from(document.querySelectorAll('.feed-item-detail[data-feed="' + safeString(e.id) + '"]'))
			.forEach(function (target) {
				addFeedItemButtons(target, e.doc.read.indexOf(target.dataset.feedItemId) !== -1, undefined);
			});
	});

	updateAllPodcastUI().then(updatePodcastItemsUI);
});