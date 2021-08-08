"use strict";

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
