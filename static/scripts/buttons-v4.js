/* eslint no-var:0 */
'use strict';

(function () {
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
} ());

(function () {

	function myPodcasts() {

	}

	var title = document.querySelector('.feed-title');
	if (!title) return;
	var tempButton = document.createElement('button');
	tempButton.addEventListener('click', myPodcasts);
	tempButton.textContent = 'Add to my podcasts';
	tempButton.classList.add('podcast-item__meta-button-listened');
	title.appendChild(tempButton);
} ());