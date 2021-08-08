"use strict";

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
