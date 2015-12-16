"use strict";

const assert = require('assert');
const utils = require('./../utils.js');

describe("toDict", function () {
	it("should throw for undefined input", function () {
		assert.throws(function () {
			utils.toDict();
		});
	});

	it("should throw for non-array input", function () {
		assert.throws(function () {
			utils.toDict({});
		});
	});

	it("should return a bare object", function () {
		const dict = utils.toDict([]);
		assert.ok(typeof dict === 'object');
		assert.ok(!Array.isArray(dict));
		assert.strictEqual(Object.getPrototypeOf(dict), null);
	});
});

describe("clone", function () {
	it("should return a shallow clone", function () {
		const testedObjects = [{}, {a: 1, b: 'x'}, {foo: {r: 42}, bar: {taz: [{}, {baz: 1}]}}];
		for (let i = 0; i < testedObjects.length; i++) {
			let original = testedObjects[i];
			let clone = utils.clone(original);
			assert.notStrictEqual(original, clone);
			for (let key in original) {
				assert.strictEqual(original[key], clone[key]);
			}
		}
	});
});

describe("inValues", function () {
	it("should return boolean true for key present", function () {
		assert.strictEqual(utils.inValues({a: 'test'}, 'test'), true);
	});

	it("should return boolean false for key absent", function () {
		assert.strictEqual(utils.inValues({}, 'test'), false);
	});
});

describe("copySet", function () {
	it("should return a deep clone of a set", function () {
		const set = {
			species:"Gengar", item: "Choice Scarf", nature: "Timid",
			evs: {"spe":252, "spa":252, "spd":4}, ivs: {"hp":31, "atk":0, "def":31, "spa":31, "spd":31, "spe":31},
			moves: ["Will-O-Wisp", "Hex", "Sludge Bomb", "Destiny Bond"],
			ability:"Levitate", level: 100
		};
		const copy = utils.copySet(set);
		assert.notStrictEqual(set, copy);
		assert.deepEqual(set, copy);
	});

	it("should have a non-enumerable truthy `isClone` property", function () {
		const set = {
			species:"Gengar", item: "Choice Scarf", nature: "Timid",
			evs: {"spe":252, "spa":252, "spd":4}, ivs: {"hp":31, "atk":0, "def":31, "spa":31, "spd":31, "spe":31},
			moves: ["Will-O-Wisp", "Hex", "Sludge Bomb", "Destiny Bond"],
			ability:"Levitate", level: 100
		};
		const copy = utils.copySet(set);
		const descriptor = Object.getOwnPropertyDescriptor(copy, 'isClone');
		assert.ok(descriptor);
		assert.ok(!descriptor.enumerable);
	});
});
