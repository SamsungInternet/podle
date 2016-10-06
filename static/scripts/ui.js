// Some extra nice ui interactions to make it seem more app like
/* eslint no-console: 0, no-var: 0 */

// Custom WebFonts
window.WebFontConfig = {
  google: {
    families: ['Raleway']
  },
  timeout: 2000 // Set the timeout to two seconds
};

(function(d) {
	var wf = d.createElement('script'), s = d.scripts[0];
	wf.src = 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.16/webfont.js';
	s.parentNode.insertBefore(wf, s);
})(document);