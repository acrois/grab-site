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

/*** End of utility code ***/



var JobsTracker = function() {
	this.known = {};
	this.sorted = [];
	this.finishedArray = [];
	this.finishedSet = {};
	this.fatalExceptionSet = {};
};

JobsTracker.prototype.countActive = function() {
	return this.sorted.length - this.finishedArray.length;
};

JobsTracker.prototype.resort = function() {
	this.sorted.sort(function(a, b) {
		return a["started_at"] > b["started_at"] ? -1 : 1
	});
};

/**
 * Returns true if a new job was added
 */
JobsTracker.prototype.handleJobData = function(jobData) {
	var ident = jobData["ident"];
	var alreadyKnown = ident in this.known;
	if (!alreadyKnown) {
		this.known[ident] = true;
		this.sorted.push(jobData);
		this.resort();
	}
	return !alreadyKnown;
};

JobsTracker.prototype.markFinished = function(ident) {
	if (!(ident in this.finishedSet)) {
		this.finishedSet[ident] = true;
		this.finishedArray.push(ident);
	}
};

JobsTracker.prototype.markUnfinished = function(ident) {
	if (ident in this.finishedSet) {
		delete this.finishedSet[ident];
		removeFromArray(this.finishedArray, ident);
	}
	// Job was restarted, so unmark fatal exception
	if (ident in this.fatalExceptionSet) {
		delete this.fatalExceptionSet[ident];
	}
};

JobsTracker.prototype.markFatalException = function(ident) {
	this.fatalExceptionSet[ident] = true;
};

JobsTracker.prototype.hasFatalException = function(ident) {
	return ident in this.fatalExceptionSet;
};



var JobRenderInfo = function(logWindow, logSegment, statsElements, jobNote, lineCountWindow, lineCountSegments) {
	this.logWindow = logWindow;
	this.logSegment = logSegment;
	this.statsElements = statsElements;
	this.jobNote = jobNote;
	this.lineCountWindow = lineCountWindow;
	this.lineCountSegments = lineCountSegments;
};



var Reusable = {
	obj_className_line_normal: {
		"className": "line-normal"
	},
	obj_className_line_error: {
		"className": "line-error"
	},
	obj_className_line_warning: {
		"className": "line-warning"
	},
	obj_className_line_redirect: {
		"className": "line-redirect"
	},
	//
	obj_className_line_ignore: {
		"className": "line-ignore"
	},
	obj_className_line_stdout: {
		"className": "line-stdout"
	},
	obj_className_bold: {
		"className": "bold"
	}
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

var getTotalResponses = function(jobData) {
	return (
		parseInt(jobData["r1xx"]) +
		parseInt(jobData["r2xx"]) +
		parseInt(jobData["r3xx"]) +
		parseInt(jobData["r4xx"]) +
		parseInt(jobData["r5xx"]) +
		parseInt(jobData["runk"]));
};

var getSummaryResponses = function(jobData) {
	return (
		"1xx: " + numberWithCommas(jobData["r1xx"]) + "\n" +
		"2xx: " + numberWithCommas(jobData["r2xx"]) + "\n" +
		"3xx: " + numberWithCommas(jobData["r3xx"]) + "\n" +
		"4xx: " + numberWithCommas(jobData["r4xx"]) + "\n" +
		"5xx: " + numberWithCommas(jobData["r5xx"]) + "\n" +
		"Unknown: " + numberWithCommas(jobData["runk"]));
};



var JobsRenderer = function(container, filterBox, historyLines, showNicks, contextMenuRenderer) {
	this.container = container;
	this.filterBox = filterBox;
	addAnyChangeListener(this.filterBox, this.applyFilter.bind(this));
	this.filterBox.onkeypress = function(ev) {
		// So that j or k in input box does not result in job window switching
		ev.stopPropagation();
	}
	this.historyLines = historyLines;
	this.showNicks = showNicks;
	this.contextMenuRenderer = contextMenuRenderer;
	this.linesPerSegment = Math.max(1, Math.round(this.historyLines / 10));
	this.jobs = new JobsTracker();
	// ident -> JobRenderInfo
	this.renderInfo = {};
	this.mouseInside = null;
	this.numCrawls = byId('num-crawls');
	this.aligned = false;
};

JobsRenderer.prototype._getNextJobInSorted = function(ident) {
	for (var i = 0; i < this.jobs.sorted.length; i++) {
		var e = this.jobs.sorted[i];
		if (e["ident"] == ident) {
			return this.jobs.sorted[i + 1];
		}
	}
	return null;
};

JobsRenderer.prototype._createLogSegment = function() {
	return h('div');
};

JobsRenderer.prototype._createLogContainer = function(jobData) {
	var ident = jobData["ident"];
	var beforeJob = this._getNextJobInSorted(ident);
	var beforeElement = beforeJob == null ? null : byId("log-container-" + beforeJob["ident"]);

	var logSegment = this._createLogSegment();

	var logWindowAttrs = {
		"className": "log-window",
		"id": "log-window-" + ident,
		"onmouseenter": function(ev) {
			this.mouseInside = ident;
			ev.target.classList.add('log-window-stopped');
		}.bind(this),
		"onmouseleave": function(ev) {
			var leave = function() {
				this.mouseInside = null;
				ev.target.classList.remove('log-window-stopped');
			}.bind(this);
			// When our custom context menu pops up, it causes onmouseleave on the
			// log window, so make our leave callback fire only after the context
			// menu is closed.
			if (this.contextMenuRenderer.visible) {
				this.contextMenuRenderer.callAfterBlur(leave);
			} else {
				leave();
			}
		}.bind(this)
	}

	// If you reach the end of a log window, the browser annoyingly
	// starts to scroll the page instead.  We prevent this behavior here.
	// If the user wants to scroll the page, they need to move their
	// mouse outside a log window first.
	if (isChrome && getChromeMajorVersion() >= 63) {
		// No need to attach an event; .log-window { overscroll-behavior: contain } will take care of it.
	} else if (!isSafari) {
		logWindowAttrs["onwheel"] = function(ev) {
			// Note: offsetHeight is "wrong" by 2px but it doesn't matter
			//console.log(ev, logWindow.scrollTop, (logWindow.scrollHeight - logWindow.offsetHeight));
			if (ev.deltaY < 0 && logWindow.scrollTop == 0) {
				ev.preventDefault();
			} else if (ev.deltaY > 0 && logWindow.scrollTop >= (logWindow.scrollHeight - logWindow.offsetHeight)) {
				ev.preventDefault();
			}
		}
	} else {
		// Safari 7.0.5 can't preventDefault or stopPropagation an onwheel event,
		// so use onmousewheel instead.
		logWindowAttrs["onmousewheel"] = function(ev) {
			//console.log(ev, logWindow.scrollTop, (logWindow.scrollHeight - logWindow.offsetHeight));
			if (ev.wheelDeltaY > 0 && logWindow.scrollTop == 0) {
				ev.preventDefault();
			} else if (ev.wheelDeltaY < 0 && logWindow.scrollTop >= (logWindow.scrollHeight - logWindow.offsetHeight)) {
				ev.preventDefault();
			}
		}
	}

	var statsElements = {
		mb: h("span", {
			"className": "inline-stat job-mb"
		}, "?"),
		responses: h("span", {
			"className": "inline-stat job-responses"
		}, "?"),
		responsesPerSecond: h("span", {
			"className": "inline-stat job-responses-per-second"
		}, "?"),
		queueLength: h("span", {
			"className": "inline-stat job-in-queue"
		}, "? in q."),
		connections: h("span", {
			"className": "inline-stat job-connections"
		}, "?"),
		delay: h("span", {
			"className": "inline-stat job-delay"
		}, "? ms delay"),
		ignores: h("span", {
			"className": "job-ignores"
		}, "?"),
		jobInfo: null /* set later */
	};

	var startedISOString = new Date(parseFloat(jobData["started_at"]) * 1000).toISOString();
	var jobNote = h("span", {
		"className": "job-note"
	}, null);

	statsElements.jobInfo = h(
		"span", {
			"className": "job-info"
		}, [
			h("a", {
				"className": "inline-stat job-url",
				"href": jobData["url"]
			}, jobData["url"]),
			// Clicking anywhere in this area will set the filter to a regexp that
			// matches only this job URL, thus hiding everything but this job.
			h("span", {
				"className": "stats-elements",
				"onclick": function() {
					var filter = ds.getFilter();
					if (RegExp(filter).test(jobData["url"]) && startsWith(filter, "^") && endsWith(filter, "$")) {
						// If we're already showing just this log window, go back
						// to showing nothing.
						ds.setFilter("^$");
					} else {
						ds.setFilter("^" + regExpEscape(jobData["url"]) + "$");
					}
				}
			}, [
				" on ",
				h("span", {
					"className": "inline-stat",
					"title": startedISOString
				}, startedISOString.split("T")[0].substr(5)),
				h("span", {
					"className": "inline-stat job-nick"
				}, (this.showNicks ? " by " + jobData["started_by"] : "")),
				jobNote,
				"; ",
				statsElements.mb,
				" MB in ",
				statsElements.responses,
				" at ",
				statsElements.responsesPerSecond,
				"/s, ",
				statsElements.queueLength,
				"; ",
				statsElements.connections,
				" con. w/ ",
				statsElements.delay,
				"; ",
				statsElements.ignores
			])
		]
	);

	var logWindow = h('div', logWindowAttrs, logSegment);
	var div = h(
		'div', {
			"id": "log-container-" + ident
		}, [
			h("div", {
				"className": "job-header"
			}, [
				statsElements.jobInfo,
				h("input", {
					"className": "job-ident",
					"type": "text",
					"value": ident,
					"size": "28",
					"spellcheck": "false",
					"readonly": "",
					"onclick": function() {
						this.select();
					}
				})
			]),
			logWindow
		]
	);
	this.renderInfo[ident] = new JobRenderInfo(logWindow, logSegment, statsElements, jobNote, 0, [0]);
	this.container.insertBefore(div, beforeElement);
	// Set appropriate CSS classes - we might be in aligned mode already
	this.updateAlign();
	// Filter hasn't changed, but we might need to filter out the new job, or
	// add/remove log-window-expanded class
	this.applyFilter();
}

JobsRenderer.prototype._renderDownloadLine = function(data, logSegment) {
	var code = data["response_code"];
	if (code >= 400 && code < 500) {
		var attrs = {
			"className": "line-warning",
			"href": data["url"]
		};
	} else if (code === 0 || code >= 500) {
		var attrs = {
			"className": "line-error",
			"href": data["url"]
		};
	} else if (code && code >= 300 && code < 400) {
		var attrs = {
			"className": "line-redirect",
			"href": data["url"]
		};
	} else {
		var attrs = {
			"className": "line-normal",
			"href": data["url"]
		};
	}
	logSegment.appendChild(
		h("a", attrs, code + " " + data["wget_code"] + " " + data["url"])
	);
	return 1;
};

/**
 * Like _renderDownloadLine, but makes it easier to start a text selection from the
 * left or right of the URL.
 */
JobsRenderer.prototype._moreDomRenderDownloadLine = function(data, logSegment) {
	var code = data["response_code"];
	if (code >= 400 && code < 500) {
		var attrs = Reusable.obj_className_line_warning;
	} else if (code === 0 || code >= 500) {
		var attrs = Reusable.obj_className_line_error;
	} else if (code && code >= 300 && code < 400) {
		var attrs = Reusable.obj_className_line_redirect;
	} else {
		var attrs = Reusable.obj_className_line_normal;
	}
	logSegment.appendChild(h("div", attrs, [
		code + " " + data["wget_code"] + " ",
		h("a", {
			"href": data["url"],
			"className": "log-url"
		}, data["url"])
	]));
	return 1;
};

JobsRenderer.prototype._renderIgnoreLine = function(data, logSegment) {
	var attrs = Reusable.obj_className_line_ignore;
	logSegment.appendChild(h("div", attrs, [
		h('span', null, " IGNOR "),
		h('a', {
			"href": data["url"],
			"className": "ignore"
		}, data["url"]),
		h('span', Reusable.obj_className_bold, " by "),
		data["pattern"]
	]));
	return 1;
};

JobsRenderer.prototype._renderStdoutLine = function(data, logSegment, info, ident) {
	var cleanedMessage = data["message"].replace(/[\r\n]+$/, "");
	// Format DUPE/OF messages a little more nicely
	cleanedMessage = cleanedMessage.replace(/^DUPE /, "  DUPE ").replace(/\n  OF /, "\n      OF ");
	var renderedLines = 0;
	if (!cleanedMessage) {
		return renderedLines;
	}
	var lines = cleanedMessage.split("\n");
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		if (!line) {
			continue;
		}
		logSegment.appendChild(h("div", Reusable.obj_className_line_stdout, line));
		renderedLines += 1;

		if (/^Finished grab \S+ \S+ with exit code ([0-13-8])$/.test(line)) {
			info.statsElements.jobInfo.classList.add('job-info-done');
			this.jobs.markFinished(ident);
		} else if (/^Finished grab \S+ \S+ with exit code |^CRITICAL (Sorry|Please report)|^ERROR Fatal exception|No space left on device|^Fatal Python error:|^(Thread|Current thread) 0x/.test(line)) {
			info.statsElements.jobInfo.classList.add('job-info-fatal');
			this.jobs.markFatalException(ident);
		} else if (/Script requested immediate stop/.test(line)) {
			// Note: above message can be in:
			// ERROR Script requested immediate stop
			// or after an ERROR Fatal exception:
			// wpull.hook.HookStop: Script requested immediate stop.
			info.statsElements.jobInfo.classList.remove('job-info-fatal');
			info.statsElements.jobInfo.classList.add('job-info-aborted');
		}
	}
	return renderedLines;
};

JobsRenderer.prototype.handleData = function(data) {
	var jobData = data["job_data"];
	var added = this.jobs.handleJobData(jobData);
	var jobsActive = this.jobs.countActive();
	this.numCrawls.textContent =
		jobsActive === 1 ?
		"1 crawl" :
		jobsActive + " crawls";
	if (added) {
		this._createLogContainer(jobData);
	}
	var type = data["type"];
	var ident = jobData["ident"];

	var info = this.renderInfo[ident];
	if (!info) {
		console.warn("No render info for " + ident);
		return;
	}

	var totalResponses = parseInt(getTotalResponses(jobData));
	if (type == "download") {
		var linesRendered = this._renderDownloadLine(data, info.logSegment);
	} else if (type == "stdout" || type == "stderr") {
		var linesRendered = this._renderStdoutLine(data, info.logSegment, info, ident);
	} else if (type == "ignore") {
		var linesRendered = this._renderIgnoreLine(data, info.logSegment);
	} else {
		assert(false, "Unexpected message type " + type);
	}

	// Update stats
	info.statsElements.mb.textContent =
		numberWithCommas(
			toStringTenths(
				(parseInt(jobData["bytes_downloaded"]) / (1024 * 1024)).toString()));
	info.statsElements.responses.textContent =
		numberWithCommas(totalResponses) + " resp.";
	info.statsElements.responses.title = getSummaryResponses(jobData);
	var duration = Date.now() / 1000 - parseFloat(jobData["started_at"]);
	info.statsElements.responsesPerSecond.textContent =
		toStringTenths(totalResponses / duration);

	if (jobData["items_queued"] && jobData["items_downloaded"]) {
		var totalQueued = parseInt(jobData["items_queued"], 10);
		var totalDownloaded = parseInt(jobData["items_downloaded"], 10);
		info.statsElements.queueLength.textContent =
			numberWithCommas((totalQueued - totalDownloaded) + " in q.");
		info.statsElements.queueLength.title =
			numberWithCommas(totalQueued) + " queued\n" +
			numberWithCommas(totalDownloaded) + " downloaded";
	}

	info.statsElements.connections.textContent = jobData["concurrency"];

	var delayMin = parseInt(jobData["delay_min"]);
	var delayMax = parseInt(jobData["delay_max"]);
	info.statsElements.delay.textContent =
		(delayMin == delayMax ?
			delayMin :
			delayMin + "-" + delayMax) + " ms delay";

	if (jobData["suppress_ignore_reports"]) {
		info.statsElements.ignores.textContent = 'igoff';
		if (!info.statsElements.ignores.classList.contains('job-igoff')) {
			info.statsElements.ignores.classList.add('job-igoff');
		}
	} else {
		info.statsElements.ignores.textContent = 'igon';
		if (info.statsElements.ignores.classList.contains('job-igoff')) {
			info.statsElements.ignores.classList.remove('job-igoff');
		}
	}

	// Update note
	info.jobNote.textContent =
		isBlank(jobData["note"]) ?
		"" :
		" (" + jobData["note"] + ")";

	info.lineCountWindow += linesRendered;
	info.lineCountSegments[info.lineCountSegments.length - 1] += linesRendered;

	if (info.lineCountSegments[info.lineCountSegments.length - 1] >= this.linesPerSegment) {
		//console.log("Created new segment", info);
		var newSegment = this._createLogSegment();
		info.logWindow.appendChild(newSegment);
		info.logSegment = newSegment;
		info.lineCountSegments.push(0);
	}

	if (this.mouseInside != ident) {
		// Don't remove any scrollback information when the job has a fatal exception,
		// so that the user can find the traceback and report a bug.
		if (!this.jobs.hasFatalException(ident)) {
			// We may have to remove more than one segment, if the user
			// has paused the log window for a while.
			while (info.lineCountWindow >= this.historyLines + this.linesPerSegment) {
				var firstLogSegment = info.logWindow.firstChild;
				assert(firstLogSegment != null, "info.logWindow.firstChild is null; " +
					JSON.stringify({
						"lineCountWindow": info.lineCountWindow,
						"lineCountSegments": info.lineCountSegments
					}));
				info.logWindow.removeChild(firstLogSegment);
				info.lineCountWindow -= info.lineCountSegments[0];
				info.lineCountSegments.shift();
			}
		}

		// Scroll to the bottom
		// To avoid serious performance problems in Firefox, we use a big number
		// instead of info.logWindow.scrollHeight.
		info.logWindow.scrollTop = 999999;
	}
};

JobsRenderer.prototype.applyFilter = function() {
	var query = this.filterBox.value;
	var matches = 0;
	var matchedWindows = [];
	var unmatchedWindows = [];
	this.firstFilterMatch = null;
	for (var i = 0; i < this.jobs.sorted.length; i++) {
		var job = this.jobs.sorted[i];
		var w = this.renderInfo[job["ident"]].logWindow;
		if (!RegExp(query).test(job["url"])) {
			w.classList.add("log-window-hidden");
			// Firefox exhibits serious performance problems when adding
			// lines to our 0px-high log windows, so add display: none
			// (effectively killing the animation)
			if (isFirefox) {
				w.style.display = "none";
			}

			// Remove this class, else an ugly border may be visible
			w.classList.remove('log-window-stopped');
			unmatchedWindows.push(w);
		} else {
			w.classList.remove("log-window-hidden");
			if (isFirefox) {
				w.style.display = "block";
			}

			matches += 1;
			matchedWindows.push(w);
			if (this.firstFilterMatch == null) {
				this.firstFilterMatch = job;
			}
		}
	}

	// If there's only one visible log window, expand it so that more lines are visible.
	unmatchedWindows.map(classRemover('log-window-expanded'));
	matchedWindows.map(classRemover('log-window-expanded'));
	if (matches == 1) {
		matchedWindows.map(classAdder('log-window-expanded'));
	}

	if (matches < this.jobs.sorted.length) {
		// If you're not seeing all of the log windows, you're probably seeing very
		// few of them, so you probably want alignment enabled.
		this.aligned = true;
		this.updateAlign();
	} else {
		// You're seeing all of the log windows, so alignment doesn't help as much
		// as seeing the full info.
		this.aligned = false;
		this.updateAlign();
	}
};

JobsRenderer.prototype.showNextPrev = function(offset) {
	var idx;
	if (this.firstFilterMatch == null) {
		idx = null;
	} else {
		idx = findInArray(this.jobs.sorted, function(el, i) {
			return el["ident"] == this.firstFilterMatch["ident"];
		}.bind(this));
	}
	if (idx == null) {
		// If no job windows are shown, set up index to make j show the first job window,
		// k the last job window.
		idx = this.jobs.sorted.length;
	}
	idx = idx + offset;
	// When reaching either end, hide all job windows.  When going past
	// the end, wrap around.
	if (idx == -1) {
		idx = this.jobs.sorted.length;
	} else if (idx == this.jobs.sorted.length + 1) {
		idx = 0;
	}
	if (idx == this.jobs.sorted.length) {
		ds.setFilter("^$");
	} else {
		var newShownJob = this.jobs.sorted[idx];
		ds.setFilter("^" + regExpEscape(newShownJob["url"]) + "$");
	}
};

JobsRenderer.prototype.updateAlign = function() {
	var adderOrRemover = this.aligned ? classAdder : classRemover;
	arrayFrom(document.querySelectorAll('.job-url')).map(adderOrRemover('job-url-aligned'));
	arrayFrom(document.querySelectorAll('.job-note')).map(adderOrRemover('job-note-aligned'));
	arrayFrom(document.querySelectorAll('.job-nick')).map(adderOrRemover('job-nick-aligned'));
	arrayFrom(document.querySelectorAll('.job-mb')).map(adderOrRemover('job-mb-aligned'));
	arrayFrom(document.querySelectorAll('.job-responses')).map(adderOrRemover('job-responses-aligned'));
	arrayFrom(document.querySelectorAll('.job-responses-per-second')).map(adderOrRemover('job-responses-per-second-aligned'));
	arrayFrom(document.querySelectorAll('.job-in-queue')).map(adderOrRemover('job-in-queue-aligned'));
	arrayFrom(document.querySelectorAll('.job-connections')).map(adderOrRemover('job-connections-aligned'));
	arrayFrom(document.querySelectorAll('.job-delay')).map(adderOrRemover('job-delay-aligned'));
};

JobsRenderer.prototype.toggleAlign = function() {
	this.aligned = !this.aligned;
	this.updateAlign();
};



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



var BatchingQueue = function(callable, minInterval) {
	this.callable = callable;
	this._minInterval = minInterval;
	this.queue = [];
	this._timeout = null;
	this._boundRunCallable = this._runCallable.bind(this);
};

BatchingQueue.prototype.setMinInterval = function(minInterval) {
	this._minInterval = minInterval;
};

BatchingQueue.prototype._runCallable = function() {
	this._timeout = null;
	var queue = this.queue;
	this.queue = [];
	this.callable(queue);
};

BatchingQueue.prototype.callNow = function() {
	if (this._timeout !== null) {
		clearTimeout(this._timeout);
		this._timeout = null;
	}
	this._runCallable();
};

BatchingQueue.prototype.push = function(v) {
	this.queue.push(v);
	if (this._timeout === null) {
		this._timeout = setTimeout(this._boundRunCallable, this._minInterval);
	}
};



var Decayer = function(initial, multiplier, max) {
	this.initial = initial;
	this.multiplier = multiplier;
	this.max = max;
	this.reset();
};

Decayer.prototype.reset = function() {
	// First call to .decay() will multiply, but we want to get the `intitial`
	// value on the first call to .decay(), so divide.
	this.current = this.initial / this.multiplier;
	return this.current;
};

Decayer.prototype.decay = function() {
	this.current = Math.min(this.current * this.multiplier, this.max);
	return this.current;
};



var Dashboard = function() {
	this.messageCount = 0;

	var args = getQueryArgs();

	var historyLines = args["historyLines"] ? Number(args["historyLines"]) : navigator.userAgent.match(/Mobi/) ? 250 : 1000;
	var batchTimeWhenVisible = args["batchTimeWhenVisible"] ? Number(args["batchTimeWhenVisible"]) : 125;
	var showNicks = args["showNicks"] ? Boolean(Number(args["showNicks"])) : false;
	var contextMenu = args["contextMenu"] ? Boolean(Number(args["contextMenu"])) : true;
	var moreDom = args["moreDom"] ? Boolean(Number(args["moreDom"])) : false;
	// Append to page title to make it possible to identify the tab in Chrome's task manager
	if (args["title"]) {
		document.title += " - " + args["title"];
	}

	if (moreDom) {
		JobsRenderer.prototype._renderDownloadLine = JobsRenderer.prototype._moreDomRenderDownloadLine;
	}

	if (args["host"]) {
		this.host = args["host"];
	} else {
		// If no ?host=, connect to this grab-site server instead of some other server.
		this.host = location.host;
	}
	this.dumpTraffic = args["dumpMax"] && Number(args["dumpMax"]) > 0;
	if (this.dumpTraffic) {
		this.dumpMax = Number(args["dumpMax"]);
	}

	this.contextMenuRenderer = new ContextMenuRenderer(document);
	if (contextMenu) {
		document.oncontextmenu = this.contextMenuRenderer.onContextMenu.bind(this.contextMenuRenderer);
		document.onclick = this.contextMenuRenderer.blur.bind(this.contextMenuRenderer);
		// onkeydown picks up ESC, onkeypress doesn't (tested Chrome 44)
		document.onkeydown = function(ev) {
			if (ev.keyCode == 27) { // ESC
				this.contextMenuRenderer.blur();
			}
		}.bind(this);
		// In Chrome, the native context menu disappears when you wheel around, so
		// match that behavior for our own context menu.
		if (isChrome) {
			document.onwheel = function(ev) {
				this.contextMenuRenderer.blur();
			}.bind(this);
		}
	}

	this.jobsRenderer = new JobsRenderer(
		byId('logs'), byId('filter-box'), historyLines, showNicks, this.contextMenuRenderer);

	var batchTimeWhenHidden = 5000;

	document.onkeypress = this.keyPress.bind(this);

	// Adjust help text based on URL
	Array.prototype.slice.call(document.querySelectorAll('.url-q-or-amp')).map(function(elem) {
		if (window.location.search.indexOf("?") != -1) {
			elem.textContent = "&";
		}
	});

	if (!showNicks) {
		document.write('<style>.job-nick-aligned { width: 0; }</style>');
	}

	this.queue = new BatchingQueue(function(queue) {
		//console.log("Queue has ", queue.length, "items");
		for (var i = 0; i < queue.length; i++) {
			this.handleData(JSON.parse(queue[i]));
		}
	}.bind(this), batchTimeWhenVisible);

	this.decayer = new Decayer(1000, 1.5, 60000);
	this.connectWebSocket();

	document.addEventListener("visibilitychange", function() {
		if (document.hidden) {
			//console.log("Page has become hidden");
			this.queue.setMinInterval(batchTimeWhenHidden);
		} else {
			//console.log("Page has become visible");
			this.queue.setMinInterval(batchTimeWhenVisible);
			this.queue.callNow();
		}
	}.bind(this), false);
};

Dashboard.prototype.keyPress = function(ev) {
	//console.log(ev);

	// If you press ctrl-f or alt-f in Firefox (tested: 41), it dispatches
	// the keypress event for 'f'.  We want only the modifier-free
	// keypresses.
	if (ev.ctrlKey || ev.altKey || ev.metaKey) {
		return;
	}
	// Check shiftKey only after handling '?', because you need shift for '?'
	if (ev.which == 63) { // ?
		ds.toggleHelp();
		return;
	}
	if (ev.shiftKey) {
		return;
	}
	if (ev.which == 106) { // j
		this.jobsRenderer.showNextPrev(1);
	} else if (ev.which == 107) { // k
		this.jobsRenderer.showNextPrev(-1);
	} else if (ev.which == 97) { // a
		ds.setFilter('');
	} else if (ev.which == 110) { // n
		ds.setFilter('^$');
	} else if (ev.which == 102) { // f
		ev.preventDefault();
		byId('filter-box').focus();
		byId('filter-box').select();
	} else if (ev.which == 118) { // v
		window.open(this.jobsRenderer.firstFilterMatch["url"]);
	}
};

Dashboard.prototype.handleData = function(data) {
	this.messageCount += 1;
	if (this.dumpTraffic && this.messageCount <= this.dumpMax) {
		byId('traffic').appendChild(h("pre", null, prettyJson(data)));
	}
	this.jobsRenderer.handleData(data);
};

Dashboard.prototype.connectWebSocket = function() {
	// Use wss:// if we're behind a reverse proxy serving with https://
	var protocol = window.location.protocol == "https:" ? "wss:" : "ws:";
	this.ws = new WebSocket(protocol + "//" + this.host + "/stream");

	this.ws.onmessage = function(ev) {
		this.queue.push(ev["data"]);
	}.bind(this);

	this.ws.onopen = function(ev) {
		console.log("WebSocket opened:", ev);
		this.ws.send(JSON.stringify({
			"type": "hello",
			"mode": "dashboard",
			"user_agent": navigator.userAgent
		}));
		this.decayer.reset();
	}.bind(this);

	this.ws.onclose = function(ev) {
		console.log("WebSocket closed:", ev);
		var delay = this.decayer.decay();
		console.log("Reconnecting in", delay, "ms");
		setTimeout(this.connectWebSocket.bind(this), delay);
	}.bind(this);
};

Dashboard.prototype.toggleAlign = function() {
	this.jobsRenderer.toggleAlign();
};

Dashboard.prototype.toggleHelp = function() {
	var help = byId('help');
	if (help.classList.contains('undisplayed')) {
		help.classList.remove('undisplayed');
	} else {
		help.classList.add('undisplayed');
	}
};

Dashboard.prototype.getFilter = function(value) {
	return byId('filter-box').value;
};

Dashboard.prototype.setFilter = function(value) {
	byId('filter-box').value = value;
	byId('filter-box').onchange();
};

var ds = new Dashboard();
