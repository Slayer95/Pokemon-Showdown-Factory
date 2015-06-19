var util = require('util');
var stream = require('stream');

var fullTierList = ['Uber', 'OU', 'BL', 'UU', 'BL2', 'RU', 'BL3', 'NU'];
var tierPositions = Object.create(null);
for (var i = 0; i < fullTierList.length; i++) {
	tierPositions[fullTierList[i]] = i;
}

exports.tiers = fullTierList;
exports.getTierIndex = function (tier) {
	return tierPositions[tier];
};

exports.toDict = function (data) {
	if (!Array.isArray(data)) throw new TypeError("toDict only accepts arrays as input");
	var dict = Object.create(null);
	for (var i = 0, len = data.length; i < len; i++) {
		dict[data[i]] = 1;
	}
	return dict;
};

exports.inValues = function inValues (obj, val) {
	for (var key in obj) {
		if (obj[key] === val) return true;
	}
	return false;
};

var cloneObject = exports.clone = function clone (obj) {
	var clonedObj = {};
	for (var key in obj) {
		clonedObj[key] = obj[key];
	}
	return clonedObj;
};

var setKeys = ['species', 'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'evs', 'ivs', 'nature', 'moves'];

exports.markConflict = function markConflict (set, conflict) {
	return Object.defineProperty(set, 'conflict', {
		value: conflict,
		enumerable: false,
		writable: true,
		configurable: true
	});
};

var markClone = exports.markClone = function markClone (set) {
	return Object.defineProperty(set, 'isClone', {
		value: true,
		enumerable: false,
		writable: true,
		configurable: true
	});
};

exports.copySet = function copySet (set) {
	var clone = {};

	for (var i = 0; i < setKeys.length; i++) {
		var key = setKeys[i];
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
			for (var j = 0; j < set[key].length; j++) {
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

function OutputStream () {
	stream.Writable.call(this);
	this.setData = '';
}
util.inherits(OutputStream, stream.Writable);
OutputStream.prototype.write = function (data) {
	this.setData += data;
};

exports.OutputStream = OutputStream;
