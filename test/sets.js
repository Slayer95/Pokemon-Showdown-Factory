"use strict";

var OutStream = require('./../utils.js').OutputStream;
var builder = require('./..');

describe("Collected data", function () {
	it("should not have any error", function (done) {
		builder.run({
			output: new OutStream()
		}, done);
	});
});
