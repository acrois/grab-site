"use strict";

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
