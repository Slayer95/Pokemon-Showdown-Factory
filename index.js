"use strict";

const fs = require('fs');
const path = require('path');
const cProduct = require('cartesian-product');

(function () {
	let psConfig;
	try {
		psConfig = require('./Pokemon-Showdown/config/config.js');
	} catch (err) {
		if (err.code !== 'MODULE_NOT_FOUND') throw err;

		console.log("config.js doesn't exist - creating one with default settings...");
		fs.writeFileSync(path.resolve(__dirname, 'Pokemon-Showdown', 'config/config.js'),
			fs.readFileSync(path.resolve(__dirname, 'Pokemon-Showdown', 'config/config-example.js'))
		);
		psConfig = require('./Pokemon-Showdown/config/config.js');
	}

	psConfig.workers = 0;
})();

require('./Pokemon-Showdown');
const utils = require('./utils.js');
const parseTeams = require('./parser.js');

const toId = global.toId;
const Tools = global.Tools.includeData();
const Pokedex = Tools.data.Pokedex;
// const Movedex = Tools.data.Movedex;
const Items = Tools.data.Items;
const Natures = Tools.data.Natures;

const factoryTiers = ['Uber', 'OU', 'UU', 'RU', 'NU', 'PU'];
const uniqueOptionMoves = utils.toDict(['stealthrock', 'spikes', 'toxicspikes', 'rapidspin', 'defog', 'batonpass']); // High-impact moves

function proofRead(setLists, strict) {
	const sets = {};
	let errors = [];

	for (let tier in setLists) {
		for (let speciesid in setLists[tier]) {
			if (!Pokedex.hasOwnProperty(speciesid)) {
				errors.push("Invalid species id: " + speciesid);
				continue;
			}

			let speciesResult = proofReadSpeciesSets(setLists[tier][speciesid].sets, speciesid, tier, strict);
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

function proofReadSpeciesSets(setList, startSpecies, tier, strict) {
	const errors = [];
	const minTierIndex = utils.getTierIndex(tier);

	let output = [];

	for (let i = 0; i < setList.length; i++) {
		let set = setList[i];
		let speciesid = startSpecies;
		if (set.isClone) throw new Error("Unexpected `isClone` property");
		if (set.item && !Items.hasOwnProperty(toId(set.item))) errors.push("Invalid item for " + tier + " " + speciesid + ": '" + set.item + "'.");
		if (set.nature && !Natures.hasOwnProperty(toId(set.nature))) errors.push("Invalid nature for " + tier + " " + speciesid + ": '" + set.nature + "'.");
		if (set.evs && (!Object.values(set.evs).every(utils.isValidEV) || Object.sum(set.evs) > 510)) errors.push("Invalid EVs for " + tier + " " + speciesid + ": '" + Object.values(set.evs).join(", ") + "'.");
		if (set.ivs && !Object.values(set.ivs).every(utils.isValidIV)) errors.push("Invalid IVs for " + tier + " " + speciesid + ": '" + Object.values(set.evs).join(", ") + "'.");
		if (set.happiness && !utils.isValidHappiness(set.happiness)) errors.push("Happiness out of bounds for " + tier + " " + speciesid + ": '" + set.happiness + "'.");
		if ('level' in set && !utils.isValidLevel(set.level)) errors.push("Level out of bounds for " + tier + " " + speciesid + ": '" + set.level + "'.");
		if (!utils.inValues(Pokedex[speciesid].abilities, set.ability)) errors.push("Invalid ability for " + tier + " " + speciesid + ": '" + set.ability + "'.");

		// Mega formes are tiered separately
		if (set.item && toId(Tools.getItem(set.item).megaEvolves) === speciesid) {
			speciesid = toId(Tools.getItem(set.item).megaStone);
			if (utils.getTierIndex(Tools.getTemplate(speciesid).tier) < minTierIndex) errors.push("Pokémon " + speciesid + " is banned from " + tier);
		} else {
			if (utils.getTierIndex(Tools.getTemplate(speciesid).tier) < minTierIndex) errors.push("Pokémon " + speciesid + " is banned from " + tier);
		}

		let setsSplit = splitSetClosed(set);
		output = output.concat(setsSplit.valid);
		for (let j = 0; j < setsSplit.invalid.length; j++) {
			errors.push("Conflict between moves for " + tier + " " + speciesid + ": '" + Object.keys(setsSplit.invalid[j].conflict).join("', '") + "'");
		}
		if (strict) {
			for (let j = 0; j < setsSplit.discarded.length; j++) {
				errors.push("Conflict between alternate moves for " + tier + " " + speciesid + "'");
			}
		}
	}

	for (let i = 0; i < output.length; i++) {
		let happinessSlot = 4; // Only one slot allowed for Return / Frustration.
		let moveSlots = Object.create(null); // Only one slot allowed for any other move as well.
		let set = output[i];

		for (let j = 0; j < set.moves.length; j++) {
			let moveSlot = set.moves[j];

			for (let k = 0, totalSlashed = moveSlot.length; k < totalSlashed; k++) {
				let move = Tools.getMove(moveSlot[k]);
				if (!move.exists) {
					errors.push("Invalid move for " + startSpecies + ": '" + move.name + "'");
					continue;
				}
				let moveName = move.name;
				if (moveName !== moveSlot[k]) moveSlot[k] = moveName;

				if (moveSlots[move.id] <= j) {
					errors.push("Duplicate move " + moveName + " for " + startSpecies + ".");
				} else {
					moveSlots[move.id] = j;
				}

				if (move.id === 'frustration' || move.id === 'return') {
					if (happinessSlot < j) {
						errors.push("Duplicate happiness-based moves for " + startSpecies + "."); // Meta-based rejection
					} else {
						happinessSlot = j;
						set.happiness = (move.id === 'frustration' ? 0 : 255);
					}
				}

				if (move.id === 'hiddenpower') {
					let hpType = moveName.slice(13);
					set.ivs = utils.clone(Tools.getType(hpType).HPivs || {});
				}
			}
		}
	}

	return {errors: errors, sets: output};
}

function getSetVariants(set) {
	const setVariants = {moves: []};

	const moveCount = Object.create(null);
	const duplicateMoves = Object.create(null);
	for (let i = 0; i < set.moves.length; i++) {
		for (let j = 0; j < set.moves[i].length; j++) {
			let move = Tools.getMove(set.moves[i][j]);
			if (moveCount[move.id]) {
				moveCount[move.id]++;
				duplicateMoves[move.id] = 1;
			} else {
				moveCount[move.id] = 1;
			}
		}
	}

	for (let i = 0; i < set.moves.length; i++) {
		let slotAlts = set.moves[i];
		let setsBase = [];
		let setsImplied = [];

		for (let j = 0, totalOptions = slotAlts.length; j < totalOptions; j++) {
			let move = Tools.getMove(slotAlts[j]);
			let moveName = move.name;
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
		let slotAltsOutput = [].concat(setsImplied);
		if (setsBase.length) slotAltsOutput.unshift(setsBase);
		setVariants.moves.push(slotAltsOutput);
	}

	return setVariants;
}

// `setDivided` has a property `moves`, which is an array (thereafter "the moveset"), whose elements are n arrays with arbitrary dimensions D1, D2, ..., Dn.
// Returns an array of up to Π Di copies of `set`, having their property `moves` replaced by each element of the n-ary Cartesian product of the moveset elements, holding the condition:
// a) Subsets of each such element should be disjoint sets.

function combineVariants(set, setDivided) {
	// 1) `valid`: Valid combinations
	// 2) `discarded`: Invalid combinations between slashed moves only
	// 3) `invalid`: Invalid combinations including fixed moves
	const output = {valid: [], discarded: [], invalid: []};
	const combinations = cProduct(setDivided.moves);
	const fixedMoves = Object.create(null);
	for (let i = 0; i < set.moves.length; i++) {
		if (set.moves[i].length <= 1) fixedMoves[Tools.getMove(set.moves[i][0]).name] = 1;
	}
	for (let i = 0; i < combinations.length; i++) {
		let combination = combinations[i];
		let partitionCheck = checkPartition(combination);
		let setClone = utils.copySet(set);
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

function checkPartition(arr) {
	let result = true;
	const duplicateMoves = Object.create(null);
	const elems = Object.create(null);
	for (let i = 0; i < arr.length; i++) {
		for (let j = 0; j < arr[i].length; j++) {
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

function splitSetClosed(set) {
	const variantsSplit = getSetVariants(set);
	const combinedVariants = combineVariants(set, variantsSplit);
	return combinedVariants;
}

function addFlags(setLists) {
	const hasMegaEvo = Tools.data.Scripts.hasMegaEvo.bind(Tools);

	for (let tier in setLists) {
		for (let speciesId in setLists[tier]) {
			let flags = setLists[tier][speciesId].flags;
			let template = Tools.getTemplate(speciesId);
			if (hasMegaEvo(template)) {
				let megaOnly = true;
				for (let i = 0, len = setLists[tier][speciesId].sets.length; i < len; i++) {
					let set = setLists[tier][speciesId].sets[i];
					if (Tools.getItem(set.item).megaStone) continue;
					megaOnly = false;
					break;
				}
				if (megaOnly) flags.megaOnly = 1;
			}
		}
	}
}

function buildSets(options, callback) {
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

	const setListsRaw = {};
	const setListsByTier = {};

	const setData = [];
	if (!options.setData) {
		factoryTiers.forEach(function (tier) {
			setData.push({
				tier: tier,
				path: path.resolve(__dirname, 'data', tier.toLowerCase() + '.txt')
			});
		});
	} else {
		for (let tier in options.setData) {
			setData.push({
				tier: tier,
				path: options.setData[tier]
			});
		}
	}

	setData.forEach(function (tierData) {
		tierData.content = fs.readFileSync(tierData.path, 'utf8');
	});

	for (let i = 0; i < setData.length; i++) {
		setListsRaw[setData[i].tier] = parseTeams(setData[i].content);
		setListsByTier[setData[i].tier] = {};
	}

	// Classify sets according to tier and species
	for (let tier in setListsRaw) {
		let viableSets = setListsByTier[tier];
		for (let i = 0, len = setListsRaw[tier].length; i < len; i++) {
			let set = setListsRaw[tier][i];
			let speciesid = toId(set.species);
			if (!viableSets[speciesid]) viableSets[speciesid] = {sets: []};
			viableSets[speciesid].sets.push(set);
		}
	}

	// Check for weird stuff, and fix if possible
	const result = proofRead(setListsByTier, !!options.strict);
	if (result.errors.length) {
		return callback(new Error(result.errors.join('\n')));
	}

	// Add flags to describe the sets of each Pokémon
	addFlags(result.sets);

	// Export as JSON
	const output = options.output || fs.createWriteStream(path.resolve(__dirname, 'factory-sets.json'), {encoding: 'utf8'});
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
