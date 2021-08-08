"use strict";

/**
 * This context menu pops up when you right-click on a URL in
 * a log window, helping you copy a regexp based on the URL
 * you right-clicked.
 */
var ContextMenuRenderer = function() {
	this.visible = false;
	this.callAfterBlurFns = [];
	this.element = byId('context-menu');
};

/**
 * Returns true if the event target is a URL in a log window
 */
ContextMenuRenderer.prototype.clickedOnLogWindowURL = function(ev) {
	var cn = ev.target.className;
	return cn == "line-normal" || cn == "line-error" || cn == "line-warning" || cn == "line-redirect" || cn == "log-url";
};

ContextMenuRenderer.prototype.makeCopyTextFn = function(text) {
	return function() {
		var clipboardScratchpad = byId('clipboard-scratchpad');
		clipboardScratchpad.value = text;
		clipboardScratchpad.focus();
		clipboardScratchpad.select();
		document.execCommand('copy');
	}.bind(this);
};

ContextMenuRenderer.prototype.getPathVariants = function(path) {
	var paths = [path];

	// Avoid generating a duplicate suggestion
	path = path.replace(/\/$/, "");

	while (path && path.lastIndexOf('/') != -1) {
		path = path.replace(/\/[^\/]*$/, "");
		paths.push(path + '/');
	}

	return paths;
};

ContextMenuRenderer.prototype.getSuggestedCommands = function(ident, url) {
	var schema = url.split(':')[0];
	var domain = url.split('/')[2];
	var withoutQuery = url.split('?')[0];
	var path = '/' + split(withoutQuery, '/', 3)[3];
	var reSchema = startsWith(schema, 'http') ? 'https?' : 'ftp';
	return this.getPathVariants(path).map(function(p) {
		return "^" + reSchema + "://" + regExpEscape(domain + p);
	});
};

ContextMenuRenderer.prototype.makeEntries = function(ident, url) {
	var commands = this.getSuggestedCommands(ident, url).map(function(c) {
		return h(
			'span', {
				'onclick': this.makeCopyTextFn(c)
			},
			"Copy " + c
		);
	}.bind(this));
	return [
		// Unfortunately, this does not open it in a background tab
		// like the real context menu does.
		h('a', {
			'href': url
		}, "Open link in new tab"), h('span', {
			'onclick': this.makeCopyTextFn(url)
		}, "Copy link address")
	].concat(commands);
};

ContextMenuRenderer.prototype.onContextMenu = function(ev) {
	//console.log(ev);
	if (!this.clickedOnLogWindowURL(ev)) {
		this.blur();
		return;
	}
	ev.preventDefault();
	this.visible = true;
	this.element.style.display = "block";
	this.element.style.left = ev.clientX + "px";
	this.element.style.top = ev.clientY + "px";

	removeChildren(this.element);
	// We put the clipboard-scratchpad in the fixed-positioned
	// context menu instead of elsewhere on the page, because
	// we must focus the input box to automatically copy its text,
	// and the focus operation scrolls to the element on the page,
	// and we want to avoid such scrolling.
	appendAny(this.element, h('input', {
		'type': 'text',
		'id': 'clipboard-scratchpad'
	}));

	var url = ev.target.href;
	try {
		var ident = ev.target.parentNode.parentNode.id.match(/^log-window-(.*)/)[1];
	} catch (e) {
		// moreDom=1
		var ident = ev.target.parentNode.parentNode.parentNode.id.match(/^log-window-(.*)/)[1];
	}
	var entries = this.makeEntries(ident, url);
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		entry.classList.add('context-menu-entry');
		appendAny(this.element, entry);
	}

	// If the bottom of the context menu is outside the viewport, move the context
	// menu up, so that it appears to have opened from its bottom-left corner.
	// + 1 pixel so that the pointer lands inside the element and turns on cursor: default
	if (ev.clientY + this.element.offsetHeight > document.documentElement.clientHeight) {
		this.element.style.top = (ev.clientY - this.element.offsetHeight + 1) + "px";
	}
};

ContextMenuRenderer.prototype.blur = function() {
	this.visible = false;
	this.element.style.display = "none";
	this.callAfterBlurFns.map(function(fn) {
		fn();
	});
	this.callAfterBlurFns = [];
};

// TODO: decouple - fire an onblur event instead
ContextMenuRenderer.prototype.callAfterBlur = function(fn) {
	this.callAfterBlurFns.push(fn);
};
