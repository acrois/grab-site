"use strict";

var assert = function(condition, message) {
	if (!condition) {
		throw message || "Assertion failed";
	}
};

var byId = function(id) {
	return document.getElementById(id);
};

var text = function(s) {
	return document.createTextNode(s);
};

/**
 * Adaptation of ActiveSupport's #blank?.
 *
 * Returns true if the object is undefined, null, or is a string whose
 * post-trim length is zero.  Otherwise, returns false.
 */
var isBlank = function(o) {
	return !o || o.trim().length === 0;
}

/**
 * appendChild but accepts strings and arrays of children|strings
 */
var appendAny = function(e, thing) {
	if (Array.isArray(thing)) {
		for (var i = 0; i < thing.length; i++) {
			appendAny(e, thing[i]);
		}
	} else if (typeof thing == "string") {
		e.appendChild(text(thing));
	} else {
		if (thing == null) {
			throw Error("thing is " + JSON.stringify(thing));
		}
		e.appendChild(thing);
	}
};

/**
 * Create DOM element with attributes and children from Array<node|string>|node|string
 */
var h = function(elem, attrs, thing) {
	var e = document.createElement(elem);
	if (attrs != null) {
		for (var attr in attrs) {
			if (attr == "spellcheck" || attr == "readonly") {
				e.setAttribute(attr, attrs[attr]);
			} else if (attr == "class") {
				throw new Error("Did you mean className?");
			} else {
				e[attr] = attrs[attr];
			}
		}
	}
	if (thing != null) {
		appendAny(e, thing);
	}
	return e;
};

var href = function(href, text) {
	var a = h("a");
	a.href = href;
	a.textContent = text;
	return a;
};

var removeChildren = function(elem) {
	while (elem.firstChild) {
		elem.removeChild(elem.firstChild);
	}
};

var prettyJson = function(obj) {
	return JSON.stringify(obj, undefined, 2);
};

// Copied from Coreweb/js_coreweb/cw/string.js
/**
 * Like Python's s.split(delim, num) and s.split(delim)
 * This does *NOT* implement Python's no-argument s.split()
 *
 * @param {string} s The string to split.
 * @param {string} sep The separator to split by.
 * @param {number} maxsplit Maximum number of times to split.
 *
 * @return {!Array.<string>} The splitted string, as an array.
 */
var split = function(s, sep, maxsplit) {
	assert(typeof sep == "string",
		"arguments[1] of split must be a separator string");
	if (maxsplit === undefined || maxsplit < 0) {
		return s.split(sep);
	}
	var pieces = s.split(sep);
	var head = pieces.splice(0, maxsplit);
	// after the splice, pieces is shorter and no longer has the `head` elements.
	if (pieces.length > 0) {
		var tail = pieces.join(sep);
		head.push(tail); // no longer just the head.
	}
	return head;
};

// Copied from closure-library's goog.string.startsWith
var startsWith = function(str, prefix) {
	return str.lastIndexOf(prefix, 0) == 0;
}

// Copied from closure-library's goog.string.endsWith
var endsWith = function(str, suffix) {
	var l = str.length - suffix.length;
	return l >= 0 && str.indexOf(suffix, l) == l;
};

// Based on closure-library's goog.string.regExpEscape
var regExpEscape = function(s) {
	var escaped = String(s).replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1').
	replace(/\x08/g, '\\x08');
	if (s.indexOf('[') == -1 && s.indexOf(']') == -1) {
		// If there were no character classes, there can't have been any need
		// to escape -, to unescape them.
		escaped = escaped.replace(/\\-/g, "-");
	}
	return escaped;
};

/**
 * [[1, 2], [3, 4]] -> {1: 2, 3: 4}
 */
var intoObject = function(arr) {
	var obj = {};
	arr.forEach(function(e) {
		obj[e[0]] = e[1];
	});
	return obj;
};

var getQueryArgs = function() {
	var pairs = location.search.replace("?", "").split("&");
	if (pairs == "") {
		return {};
	}
	return intoObject(pairs.map(function(e) {
		return split(e, "=", 1);
	}));
};

var getChromeMajorVersion = function() {
	return Number(navigator.userAgent.match(/Chrome\/(\d+)/)[1]);
};

var getFirefoxMajorVersion = function() {
	return Number(navigator.userAgent.match(/Firefox\/(\d+)/)[1]);
};

var getTridentMajorVersion = function() {
	return Number(navigator.userAgent.match(/Trident\/(\d+)/)[1]);
};

var isChrome = navigator.userAgent.indexOf("Chrome/") != -1;
var isSafari = !isChrome && navigator.userAgent.indexOf("Safari") != -1;
var isFirefox = navigator.userAgent.indexOf("Firefox") != -1;
var isTrident = navigator.userAgent.indexOf("Trident/") != -1;

var addAnyChangeListener = function(elem, func) {
	// DOM0 handler for convenient use by Clear button
	elem.onchange = func;
	elem.addEventListener('keydown', func, false);
	elem.addEventListener('paste', func, false);
	elem.addEventListener('input', func, false);
};

var arrayFrom = function(arrayLike) {
	return Array.prototype.slice.call(arrayLike);
};

/**
 * Returns a function that gets the given property on any object passed in
 */
var prop = function(name) {
	return function(obj) {
		return obj[name];
	};
};

/**
 * Returns a function that adds the given class to any element passed in
 */
var classAdder = function(name) {
	return function(elem) {
		elem.classList.add(name);
	};
};

/**
 * Returns a function that removes the given class to any element passed in
 */
var classRemover = function(name) {
	return function(elem) {
		elem.classList.remove(name);
	};
};

var removeFromArray = function(arr, item) {
	var idx = arr.indexOf(item);
	if (idx != -1) {
		arr.splice(idx, 1);
	}
};

// Based on http://stackoverflow.com/a/18520276
var findInArray = function(arr, test, ctx) {
	var result = null;
	arr.some(function(el, i) {
		return test.call(ctx, el, i, arr) ? ((result = i), true) : false;
	});
	return result;
};

// http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
var numberWithCommas = function(s_or_n) {
	return ("" + s_or_n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

var toStringTenths = function(n) {
	var s = "" + (Math.round(10 * n) / 10);
	if (s.indexOf(".") == -1) {
		s += ".0";
	}
	return s;
};
