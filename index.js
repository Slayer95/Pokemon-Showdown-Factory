var fs = require('fs');
var path = require('path');

require('./Pokemon-Showdown');
var utils = require('./utils.js');
var parseTeams = require('./parser.js');

var Tools = global.Tools;
var Pokedex = Tools.data.Pokedex;
var Movedex = Tools.data.Movedex;
var Items = Tools.data.Items;
var Natures = Tools.data.Natures;

var factoryTiers = ['Uber', 'OU', 'UU', 'RU', 'NU'];
var uniqueOptionMoves = utils.toDict(['stealthrock', 'spikes', 'toxicspikes', 'rapidspin', 'defog', 'batonpass']); // High-impact moves

function getSetDataMove (setData) {
	return setData.move;
}

function isValidMove (move) {
	return Movedex.hasOwnProperty(toId(move));
}

function proofRead (setLists) {
	var errors = [];
	var sets = {};

	for (var tier in setLists) {
		var minTierIndex = utils.getTierIndex(tier);

		for (var speciesid in setLists[tier]) {
			if (!Pokedex.hasOwnProperty(speciesid)) {
				errors.push("Invalid species id: " + speciesid);
				continue;
			} else if (utils.getTierIndex(Tools.getTemplate(speciesid).tier) < minTierIndex) {
				errors.push("Pokémon " + speciesid + " is banned from " + tier);
				continue;
			}

			var speciesResult = proofReadSpeciesSets(setLists[tier][speciesid].sets, speciesid, tier);
			if (speciesResult.errors.length) {
				errors = errors.concat(speciesResult.errors);
			} else {
				if (!sets[tier]) sets[tier] = {};
				sets[tier][speciesid] = {flags: {}, sets: speciesResult.sets};
			}
		}
	}

	return {errors: errors, sets: sets};
}

function splitSets (sets) {
	var output = [];
	for (var i = 0; i < sets.length; i++) {
		output = output.concat(splitSet(sets[i]));
	}
	if (output.length === sets.length) return output;
	return splitSets(output);
}

function splitSet (set) {
	var sets = [];
	var baseSet = utils.copySet(set);
	var addBaseSet = true;

	for (var i = 0, moveCount = set.moves.length; i < moveCount; i++) {
		var slotAlts = set.moves[i];
		var setsBase = [];
		var setsImplied = [];

		for (var j = 0, totalOptions = slotAlts.length; j < totalOptions; j++) {
			var move = Tools.getMove(slotAlts[j]);
			var moveName = move.name;

			if (move.id === 'hiddenpower') {
				var hpType = moveName.slice(13);
				setsImplied.push({ivs: utils.clone(Tools.getType(hpType).HPivs || {}), move: move.name});
			} else if (move.id === 'frustration' || move.id === 'return') {
				setsImplied.push({happiness: move.id === 'frustration' ? 0 : 255, move: move.name});
			} else if (totalOptions > 1 && uniqueOptionMoves[move.id]) {
				//console.log("Invalid slashed move for " + set.species + ": '" + move.name + "'. Fixed :]");
				setsImplied.push({move: move.name});
			} else {
				setsBase.push({move: move.name});
			}
		}

		for (var j = 0; j < setsImplied.length; j++) {
			var setClone = utils.copySet(set);
			setClone.moves[i] = [setsImplied[j].move];
			if ('ivs' in setsImplied[j]) setClone.ivs = setsImplied[j].ivs;
			if ('happiness' in setsImplied[j]) setClone.happiness = setsImplied[j].happiness
			sets.push(setClone);
		}

		if (setsBase.length) {
			baseSet.moves[i] = setsBase.map(getSetDataMove);
		} else {
			addBaseSet = false;
		}
	}

	if (addBaseSet) {
		sets.unshift(baseSet);
	}

	return sets;
}

function splitSetRecursive (set) {
	return splitSets(splitSet(set));
}

function proofReadSpeciesSets (setList, speciesid, tier) {
	var errors = [];
	var output = [];

	for (var i = 0; i < setList.length; i++) {
		var set = setList[i];
		if (set.isClone) throw new Error("Unexpected `isClone` property");
		if (set.item && !Items.hasOwnProperty(toId(set.item))) errors.push("Invalid item for " + speciesid + ": '" + set.item + "'.");
		if (set.nature && !Natures.hasOwnProperty(toId(set.nature))) errors.push("Invalid nature for " + speciesid + ": '" + set.nature + "'.");
		if (!utils.inValues(Pokedex[speciesid].abilities, set.ability)) errors.push("Invalid ability for " + speciesid + ": '" + set.ability + "'.");
		output = output.concat(splitSetRecursive(set));
	}

	for (var i = 0; i < output.length; i++) {
		var happinessSlot = 4; // Only one slot allowed for Return / Frustration.
		var moveSlots = Object.create(null); // Only one slot allowed for any other move as well.
		var set = output[i];

		for (var j = 0; j < set.moves.length; j++) {
			var moveSlot = set.moves[j];

			for (var k = 0, totalSlashed = moveSlot.length; k < totalSlashed; k++) {
				var move = Tools.getMove(moveSlot[k]);
				if (!move.exists) {
					errors.push("Invalid move for " + speciesid + ": '" + moveOption + "'");
					continue;
				}
				var moveName = move.name;
				if (moveName !== moveSlot[k]) moveSlot[k] = moveName;

				if (moveSlots[move.id] <= j) {
					errors.push("Duplicate move " + moveName + " for " + speciesid + ".");
				} else {
					moveSlots[move.id] = j;
				}

				if (move.id === 'frustration' || move.id === 'return') {
					if (happinessSlot < j) {
						errors.push("Duplicate happiness-based moves for " + speciesid + "."); // Meta-based rejection
					} else {
						happinessSlot = j;
					}
				}
			}
		}
	}

	return {errors: errors, sets: output};
}

function addFlags (setLists) {
	var hasMegaEvo = Tools.data.Scripts.hasMegaEvo.bind(Tools);

	for (var tier in setLists) {
		for (var speciesId in setLists[tier]) {
			var flags = setLists[tier][speciesId].flags;
			var template = Tools.getTemplate(speciesId);
			if (hasMegaEvo(template)) {
				var megaOnly = true;
				for (var i = 0, len = setLists[tier][speciesId].sets.length; i < len; i++) {
					var set = setLists[tier][speciesId].sets[i];
					if (Tools.getItem(set.item).megaStone) continue;
					megaOnly = false;
					break;
				}
				if (megaOnly) flags.megaOnly = 1;
			}
		}
	}
}

function buildSets (options, callback) {
	if (typeof callback === 'undefined' && typeof options === 'function') {
		callback = options;
		options = {};
	} else if (!options) {
		options = {};
	} else {
		// Validate options
		if (options.output && !options.output.write) throw new TypeError("Option `output` must be a writable stream");
		if (options.setData && typeof options.setData !== 'object') throw new TypeError("Option `setData` must be an object");
	}

	var setListsRaw = {};
	var setListsByTier = {};

	var setData = [];
	if (!options.setData) {
		factoryTiers.forEach(function (tier) {
			setData.push({
				tier: tier,
				path: path.resolve(__dirname, 'data', tier.toLowerCase() + '.txt')
			});
		});
	} else {
		for (var tier in options.setData) {
			setData.push({
				tier: tier,
				path: options.setData[tier]
			});
		}
	}

	setData.forEach(function (tierData) {
		tierData.content = fs.readFileSync(tierData.path, 'utf8');
	});

	for (var i = 0; i < setData.length; i++) {
		setListsRaw[setData[i].tier] = parseTeams(setData[i].content);
		setListsByTier[setData[i].tier] = {};
	}

	// Classify sets according to tier and species
	for (var tier in setListsRaw) {
		var viableSets = setListsByTier[tier];
		for (var i = 0, len = setListsRaw[tier].length; i < len; i++) {
			var set = setListsRaw[tier][i];
			var speciesid = toId(set.species);
			if (!viableSets[speciesid]) viableSets[speciesid] = {sets: []};
			viableSets[speciesid].sets.push(set);
		}
	}

	// Check for weird stuff, and fix if possible
	var result = proofRead(setListsByTier);
	if (result.errors.length) {
		return callback(new Error(result.errors.join('\n')));
	}

	// Add flags to describe the sets of each Pokémon
	addFlags(result.sets);

	// Export as JSON
	var output = options.output || fs.createWriteStream(path.resolve(__dirname, 'factory-sets.json'), {encoding: 'utf8'});
	output.write(JSON.stringify(result.sets) + '\n');
	output.end(callback);
}

exports.run = buildSets;
exports.addFlags = addFlags;
exports.proofRead = proofRead;

if (require.main === module) {
	buildSets(function (error) {
		if (error) return console.error("Failed:\n" + error.message);
		console.log("Battle Factory sets built.");
	});
}
