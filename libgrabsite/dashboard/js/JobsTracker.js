"use strict";

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
