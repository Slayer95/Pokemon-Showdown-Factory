"use strict";

const util = require('util');
const stream = require('stream');

const fullTierList = ['Uber', 'OU', 'BL', 'UU', 'BL2', 'RU', 'BL3', 'NU', 'BL4', 'PU'];
const tierPositions = Object.create(null);
for (let i = 0; i < fullTierList.length; i++) {
	tierPositions[fullTierList[i]] = i;
}

exports.tiers = fullTierList;
exports.getTierIndex = function (tier) {
	return tierPositions[tier.replace(/[\(\)]/g, '')];
};

function RangeValidator(start, end) {
	return function (value) {
		return value >= start && value <= end;
	};
}

/* Assume integer inputs */
exports.isValidEV = new RangeValidator(0, 252);
exports.isValidIV = new RangeValidator(0, 32);
exports.isValidLevel = new RangeValidator(1, 100);
exports.isValidHappiness = new RangeValidator(0, 252);

exports.toDict = function (data) {
	if (!Array.isArray(data)) throw new TypeError("toDict only accepts arrays as input");
	const dict = Object.create(null);
	for (let i = 0, len = data.length; i < len; i++) {
		dict[data[i]] = 1;
	}
	return dict;
};

exports.inValues = function inValues(obj, val) {
	for (let key in obj) {
		if (obj[key] === val) return true;
	}
	return false;
};

const cloneObject = exports.clone = function clone(obj) {
	const clonedObj = {};
	for (let key in obj) {
		clonedObj[key] = obj[key];
	}
	return clonedObj;
};

const setKeys = ['species', 'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'evs', 'ivs', 'nature', 'moves'];

exports.markConflict = function markConflict(set, conflict) {
	return Object.defineProperty(set, 'conflict', {
		value: conflict,
		enumerable: false,
		writable: true,
		configurable: true
	});
};

const markClone = exports.markClone = function markClone(set) {
	return Object.defineProperty(set, 'isClone', {
		value: true,
		enumerable: false,
		writable: true,
		configurable: true
	});
};

exports.copySet = function copySet(set) {
	const clone = {};

	for (let i = 0; i < setKeys.length; i++) {
		let key = setKeys[i];
		if (!(key in set)) continue;
		if (typeof set[key] !== 'object') {
			// Primitive; never a function (or symbol)
			clone[key] = set[key];
		} else if (!Array.isArray(set[key])) {
			// Object with depth 1
			clone[key] = cloneObject(set[key]);
		} else {
			// Array of arrays
			clone[key] = Array(set[key].length);
			for (let j = 0; j < set[key].length; j++) {
				clone[key][j] = set[key][j].slice();
			}
		}
	}

	return markClone(clone);
};

// Notations supported by PS teambuilder
exports.statIDs = {
	HP: 'hp', hp: 'hp',
	Atk: 'atk', atk: 'atk',
	Def: 'def', def: 'def',
	SpA: 'spa', SAtk: 'spa', SpAtk: 'spa', spa: 'spa',
	SpD: 'spd', SDef: 'spd', SpDef: 'spd', spd: 'spd',
	Spe: 'spe', Spd: 'spe', spe: 'spe'
};

function OutputStream() {
	stream.Writable.call(this);
	this.setData = '';
}
util.inherits(OutputStream, stream.Writable);
OutputStream.prototype.write = function (data) {
	this.setData += data;
};

exports.OutputStream = OutputStream;
