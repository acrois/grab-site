"use strict";

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
