var fs = require('fs');
var path = require('path');
var cProduct = require('cartesian-product');

require('./Pokemon-Showdown');
var utils = require('./utils.js');
var parseTeams = require('./parser.js');

var toId = global.toId;
var Tools = global.Tools;
var Pokedex = Tools.data.Pokedex;
var Movedex = Tools.data.Movedex;
var Items = Tools.data.Items;
var Natures = Tools.data.Natures;

var factoryTiers = ['Uber', 'OU', 'UU', 'RU', 'NU'];
var uniqueOptionMoves = utils.toDict(['stealthrock', 'spikes', 'toxicspikes', 'rapidspin', 'defog', 'batonpass']); // High-impact moves

function proofRead (setLists, strict) {
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

			var speciesResult = proofReadSpeciesSets(setLists[tier][speciesid].sets, speciesid, tier, strict);
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

function proofReadSpeciesSets (setList, speciesid, tier, strict) {
	var errors = [];
	var output = [];

	for (var i = 0; i < setList.length; i++) {
		var set = setList[i];
		if (set.isClone) throw new Error("Unexpected `isClone` property");
		if (set.item && !Items.hasOwnProperty(toId(set.item))) errors.push("Invalid item for " + tier + " " + speciesid + ": '" + set.item + "'.");
		if (set.nature && !Natures.hasOwnProperty(toId(set.nature))) errors.push("Invalid nature for " + tier + " " + speciesid + ": '" + set.nature + "'.");
		if (set.evs && (!Object.values(set.evs).every(utils.isValidEV) || Object.sum(set.evs) > 510)) errors.push("Invalid EVs for " + tier + " " + speciesid + ": '" + Object.values(set.evs).join(", ") + "'.");
		if (set.ivs && !Object.values(set.ivs).every(utils.isValidIV)) errors.push("Invalid IVs for " + tier + " " + speciesid + ": '" + Object.values(set.evs).join(", ") + "'.");
		if (set.happiness && !utils.isValidHappiness(set.happiness)) errors.push("Happiness out of bounds for " + tier + " " + speciesid + ": '" + set.happiness + "'.");
		if ('level' in set && !utils.isValidLevel(set.level)) errors.push("Level out of bounds for " + tier + " " + speciesid + ": '" + set.level + "'.");

		if (!utils.inValues(Pokedex[speciesid].abilities, set.ability)) errors.push("Invalid ability for " + tier + " " + speciesid + ": '" + set.ability + "'.");
		var setsSplit = splitSetClosed(set);
		output = output.concat(setsSplit.valid);
		for (var j = 0; j < setsSplit.invalid.length; j++) {
			errors.push("Conflict between moves for " + tier + " " + speciesid + ": '" + Object.keys(setsSplit.invalid[j].conflict).join("', '") + "'");
		}
		if (strict) {
			for (var j = 0; j < setsSplit.discarded.length; j++) {
				errors.push("Conflict between alternate moves for " + tier + " " + speciesid + "'");
			}
		}
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
					errors.push("Invalid move for " + speciesid + ": '" + move.name + "'");
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
						set.happiness = (move.id === 'frustration' ? 0 : 255);
					}
				}

				if (move.id === 'hiddenpower') {
					var hpType = moveName.slice(13);
					set.ivs = utils.clone(Tools.getType(hpType).HPivs || {});
				}
			}
		}
	}

	return {errors: errors, sets: output};
}

function getSetVariants (set) {
	var setVariants = {moves: []};

	var moveCount = Object.create(null);
	var duplicateMoves = Object.create(null);
	for (var i = 0; i < set.moves.length; i++) {
		for (var j = 0; j < set.moves[i].length; j++) {
			var move = Tools.getMove(set.moves[i][j]);
			if (moveCount[move.id]) {
				moveCount[move.id]++;
				duplicateMoves[move.id] = 1;
			} else {
				moveCount[move.id] = 1;
			}
		}
	}

	for (var i = 0; i < set.moves.length; i++) {
		var slotAlts = set.moves[i];
		var setsBase = [];
		var setsImplied = [];

		for (var j = 0, totalOptions = slotAlts.length; j < totalOptions; j++) {
			var move = Tools.getMove(slotAlts[j]);
			var moveName = move.name;
			moveCount[moveName] = moveCount[moveName] ? moveCount[moveName] + 1 : 1;

			if (move.id === 'hiddenpower') {
				setsImplied.push([move.name]);
			} else if (move.id === 'frustration' || move.id === 'return') {
				setsImplied.push([move.name]);
			} else if (totalOptions > 1 && (uniqueOptionMoves[move.id] || duplicateMoves[move.id])) {
				setsImplied.push([move.name]);
			} else {
				setsBase.push(move.name);
			}
		}
		var slotAltsOutput = [].concat(setsImplied);
		if (setsBase.length) slotAltsOutput.unshift(setsBase);
		setVariants.moves.push(slotAltsOutput);
	}

	return setVariants;
}

// `setDivided` has a property `moves`, which is an array (thereafter "the moveset"), whose elements are n arrays with arbitrary dimensions D1, D2, ..., Dn.
// Returns an array of up to Π Di copies of `set`, having their property `moves` replaced by each element of the n-ary Cartesian product of the moveset elements, holding the condition:
// a) Subsets of each such element should be disjoint sets.

function combineVariants (set, setDivided) {
	// 1) `valid`: Valid combinations
	// 2) `discarded`: Invalid combinations between slashed moves only
	// 3) `invalid`: Invalid combinations including fixed moves
	var output = {valid: [], discarded: [], invalid: []};
	var combinations = cProduct(setDivided.moves);
	var fixedMoves = Object.create(null);
	for (var i = 0; i < set.moves.length; i++) {
		if (set.moves[i].length <= 1) fixedMoves[Tools.getMove(set.moves[i][0]).name] = 1;
	}
	for (var i = 0; i < combinations.length; i++) {
		var combination = combinations[i];
		var partitionCheck = checkPartition(combination);
		var setClone = utils.copySet(set);
		setClone.moves = combination;
		if (partitionCheck.result) {
			output.valid.push(setClone);
		} else {
			partitionCheck = checkPartition([Object.keys(fixedMoves), Object.keys(partitionCheck.intersection)]);
			if (partitionCheck.result) {
				utils.markConflict(setClone, partitionCheck.intersection);
				output.discarded.push(setClone);
			} else {
				utils.markConflict(setClone, partitionCheck.intersection);
				output.invalid.push(setClone);
			}
		}
	}
	return output;
}

function checkPartition (arr) {
	var result = true;
	var duplicateMoves = Object.create(null);
	var elems = Object.create(null);
	for (var i = 0; i < arr.length; i++) {
		for (var j = 0; j < arr[i].length; j++) {
			if (elems[arr[i][j]]) {
				duplicateMoves[arr[i][j]] = 1;
				result = false;
			} else {
				elems[arr[i][j]] = 1;
			}
		}
	}
	return {result: result, intersection: duplicateMoves};
}

function splitSetClosed (set) {
	var variantsSplit = getSetVariants(set);
	var combinedVariants = combineVariants(set, variantsSplit);
	return combinedVariants;
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
	var result = proofRead(setListsByTier, !!options.strict);
	if (result.errors.length) {
		return callback(new Error(result.errors.join('\n')));
	}

	// Add flags to describe the sets of each Pokémon
	addFlags(result.sets);

	// Export as JSON
	var output = options.output || fs.createWriteStream(path.resolve(__dirname, 'factory-sets.json'), {encoding: 'utf8'});
	output.on('finish', callback);
	output.write(JSON.stringify(result.sets) + '\n');
	output.end();
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
