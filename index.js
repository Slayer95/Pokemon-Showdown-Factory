var fs = require('fs');

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

function readTierFile (tier) {
	return '' + fs.readFileSync('./data/' + tier.toLowerCase() + '.txt');
}

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
			} else if (utils.getTierIndex(Tools.getTemplate(speciesid).tier) < minTierIndex) {
				errors.push("Pokémon " + speciesid + " is banned from " + tier);
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

function proofReadSpeciesSets (setList, speciesid, tier) {
	var errors = [];

	for (var i = 0, len = setList.length; i < len; i++) {
		var hiddenPowerSlot = 4; // Only one slot allowed for Hidden Power.
		var happinessSlot = 4; // Only one slot allowed for Return / Frustration.
		var moveSlots = Object.create(null); // Only one slot allowed for any other move as well.

		var set = setList[i];
		if (set.item && !Items.hasOwnProperty(toId(set.item))) errors.push("Invalid item for " + speciesid + ": '" + set.item + "'.");
		if (set.nature && !Natures.hasOwnProperty(toId(set.nature))) errors.push("Invalid nature for " + speciesid + ": '" + set.nature + "'.");
		if (!utils.inValues(Pokedex[speciesid].abilities, set.ability)) errors.push("Invalid ability for " + speciesid + ": '" + set.ability + "'.");
		for (var j = 0, moveCount = set.moves.length; j < moveCount; j++) {
			var moveSlot = set.moves[j];

			// TODO: Account for Happiness / Hidden Power combinations across different move slots.
			// This requires some sort of loop or recursion.
			// Total set variants that require a different weight:
			// (Happiness options + (Any base options ? 1 : 0)) * (Hidden Power options + (Any base options ? 1 : 0))

			var setsBase = [];
			var setsImplied = [];

			for (var k = 0, totalOptions = moveSlot.length; k < totalOptions; k++) {
				var moveOption = moveSlot[k];
				if (!isValidMove(moveOption)) {
					errors.push("Invalid move for " + speciesid + ": '" + moveOption + "'");
				} else {
					if (totalOptions > 1 && uniqueOptionMoves[toId(moveOption)]) {
						errors.push("Invalid slashed move for " + speciesid + ": '" + moveOption + "'");
					}
					if (moveSlots[moveOption] <= j) {
						errors.push("Duplicate move " + moveOption + " for " + speciesid + ".");
					} else {
						moveSlots[moveOption] = j;
					}

					if (moveOption.slice(0, 14) === 'Hidden Power [') {
						if (hiddenPowerSlot < j) {
							errors.push("Duplicate Hidden Power for " + speciesid + ".");
						} else {
							var hpType = moveOption.slice(14, -1);
							moveOption = 'Hidden Power ' + hpType;
							setsImplied.push({ivs: utils.clone(Tools.getType(hpType).HPivs), move: moveOption});
						}
					} else if (moveOption === 'Frustration' || moveOption === 'Return') {
						if (happinessSlot < j) {
							// Meta-based rejection that should simplify everything.
							// After all, it's complex due to the meta-based code.
							errors.push("Duplicate happiness-based moves for " + speciesid + ".");
						} else {
							happinessSlot = j;
							setsImplied.push({happiness: moveOption === 'Frustration' ? 0 : 255, move: moveOption});
						}
					} else {
						setsBase.push({move: moveOption});
					}
				}
			}

			for (var k = 0, totalImplied = setsImplied.length; k < totalImplied; k++) {
				var setClone = utils.copySet(set);
				setClone.moves[j] = [setsImplied[k].move];
				if ('ivs' in setsImplied[k]) setClone.ivs = setsImplied[k].ivs;
				if ('happiness' in setsImplied[k]) setClone.happiness = setsImplied[k].happiness
				// Don't proof-read these extra sets for now. (This actually blocks previous TODO).
				setList.push(setClone);
			}

			if (setsBase.length) {
				set.moves[j] = setsBase.map(getSetDataMove);
			} else {
				setList.splice(i, 1);
				i--; len--;
				break;
			}
		}
	}
	return {errors: errors, sets: setList};
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

function buildSets (callback) {
	var setListsRaw = {};
	var setListsByTier = {};

	var fileContents = factoryTiers.map(readTierFile);

	for (var i = 0; i < factoryTiers.length; i++) {
		setListsRaw[factoryTiers[i]] = parseTeams(fileContents[i]);
		setListsByTier[factoryTiers[i]] = {};
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
	fs.writeFile('./factory-sets.json', JSON.stringify(result.sets) + '\n', function () {
		callback(null);
	});
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
