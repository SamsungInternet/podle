/* eslint no-var:0 */
/* global PouchDB, Set */
'use strict';

// PouchDB.debug.enable('*')
var dbPodcasts = new PouchDB('podcastURLs');
var dbPodcastItems = new PouchDB('podcastItems');

var handleErr = function(e) {
	console.log(e);
}

function addPodcastItemsButtons() {
	var items = Array.from(document.querySelectorAll('.podcast-item'));
	var item;
	var header;
	var buttonArea;
	var tempButton;

	function listenedTo() {

	}

	function addToList() {

	}

	function saveForLater() {

	}

	for (var i = 0, l = items.length; i < l; i++) {
		item = items[i];
		header = item.querySelector('.podcast-item__meta');
		buttonArea = document.createElement('div');
		buttonArea.classList.add('podcast-item__meta-button-area');

		tempButton = document.createElement('button');
		tempButton.addEventListener('click', listenedTo);
		tempButton.textContent = 'Mark as Done';
		tempButton.classList.add('podcast-item__meta-button-listened');
		buttonArea.appendChild(tempButton);

		tempButton = document.createElement('button');
		tempButton.addEventListener('click', saveForLater);
		tempButton.textContent = 'Save for later';
		tempButton.classList.add('podcast-item__meta-button-save-for-later');
		buttonArea.appendChild(tempButton);

		tempButton = document.createElement('button');
		tempButton.addEventListener('click', addToList);
		tempButton.textContent = 'Add to List';
		tempButton.classList.add('podcast-item__meta-button-add-to-list');
		buttonArea.appendChild(tempButton);

		header.appendChild(buttonArea);
	}
};

function removeDoc(doc) {
	doc._deleted = true;
	return doc;
}

function onAddToMyPodcasts(e) {
	var todo = {
		_id: e.target.dataset.url,
		type: 'podcast',
		title: e.target.dataset.name,
		url: e.target.dataset.url,
		read: []
	};
	if (e.target.dataset.action === 'add') dbPodcasts
		.put(todo)
		.then(function () {
			addFeedButton(e.target.parentNode, true);
		})
		.catch(handleErr);
	if (e.target.dataset.action === 'remove') dbPodcasts
		.get(todo._id).then(removeDoc)
		.then(dbPodcasts.put.bind(dbPodcasts))
		.then(function () {
			addFeedButton(e.target.parentNode, false);
		})
		.catch(handleErr);
}

function addFeedButton(el, isSaved) {

	var classname = 'podcast-item__meta-button-add-remove-to-my-podcasts';

	var button = el.querySelector('.' + classname);
	if (button) {

		// Only replace button if it needs replacing
		if (typeof isSaved !== 'boolean') return;

		if (isSaved === false) {
			if (button.dataset.action === 'remove') {
				// The feed is not saved but the button still says remove
				el.removeChild(button);
			} else {
				return;
			}
		} else {
			if (button.dataset.action === 'add') {
				// The feed is saved but the button still says add
				el.removeChild(button);
			} else {
				return;
			}
		}
	}

	if (!el) return;
	var text = el.dataset.name;
	var url = el.dataset.url;
	var tempButton = document.createElement('button');
	var action = isSaved === true ? 'remove' : 'add';
	tempButton.textContent = isSaved === true ? 'Remove from my podcasts' : 'Add to my podcasts';
	tempButton.addEventListener('click', onAddToMyPodcasts);
	tempButton.classList.add(classname);
	tempButton.dataset.url = url;
	tempButton.dataset.name = text;
	tempButton.dataset.action = action;;
	el.appendChild(tempButton);
};

var safeString = (function () {
	var div = document.createElement('div');

	function safeString(a) {
		div.textContent = a;
		return div.innerHTML;
	}

	return safeString;
} ());

window.addEventListener('load', function() {

	addPodcastItemsButtons();

	function updatePodcastUI() {
		dbPodcasts.allDocs({
			include_docs: true
		}).then(function(result) {
			var listHTML = '';
			var addFeedTargets = new Set(document.querySelectorAll('.feed-detail'));

			if (result.total_rows) {
				result.rows.forEach(function(row) {
					listHTML += '<li class="feed-detail" data-url="' + safeString(row.id) +'" data-name="' + safeString(row.doc.title) +'"><a href="feed?url=' + safeString(row.id) + '">' + safeString(row.doc.title) + '</a></li>';
					var matches = Array.from(document.querySelectorAll('.feed-detail[data-url="' + safeString(row.id) + '"]'));

					matches.forEach(function(el) {
						addFeedButton(el, true);
						addFeedTargets.delete(el);
					});
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
		});
	}

	function updatePodcastItemUI() {
		console.log('Updating Podcast Items UI');

		Array.from(document.querySelectorAll('.saved-for-later'))
			.forEach(function(ul) {
				console.log(ul);
			});
	}

	dbPodcastItems.changes({
		since: 'now',
		live: true
	}).on('change', updatePodcastUI);

	updatePodcastUI();
});