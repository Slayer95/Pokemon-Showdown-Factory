var fs = require('fs');

require('./Pokemon-Showdown');
var Tools = global.Tools;

var Pokedex = Tools.data.Pokedex;
var Items = Tools.data.Items;
var Natures = Tools.data.Natures;

var fullTierList = ['Uber', 'OU', 'BL', 'UU', 'BL2', 'RU', 'BL3', 'NU'];
var tierPositions = Object.create(null);
for (var i = 0; i < fullTierList.length; i++) {
	tierPositions[fullTierList[i]] = i;
}

var factoryTiers = ['Uber', 'OU', 'UU', 'RU', 'NU'];

// Generic helper functions

function cloneObj (obj) {
	var clone = {};
	for (var key in obj) {
		clone[key] = obj[key];
	}
	return clone;
}

function deepCloneSet (set) {
	var keys = ['species', 'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'evs', 'ivs', 'nature', 'moves'];
	var clone = {};

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (!(key in set)) continue;
		if (typeof set[key] !== 'object') {
			// Primitive; never a function (or symbol)
			clone[key] = set[key];
		} else if (!Array.isArray(set[key])) {
			// Object with depth 1
			clone[key] = cloneObj(set[key]);
		} else {
			// Array of arrays
			clone[key] = Array(set[key].length);
			for (var j = 0; j < set[key].length; j++) {
				clone[key][j] = set[key][j].slice();
			}
		}
	}

	return clone;
}

function inValues (obj, val) {
	for (var key in obj) {
		if (obj[key] === val) return true;
	}
	return false;
}

function getSetDataMove (setData) {
	return setData.move;
}

// Notations supported by PS teambuilder
var BattleStatIDs = {
	HP: 'hp', hp: 'hp',
	Atk: 'atk', atk: 'atk',
	Def: 'def', def: 'def',
	SpA: 'spa', SAtk: 'spa', SpAtk: 'spa', spa: 'spa',
	SpD: 'spd', SDef: 'spd', SpDef: 'spd', spd: 'spd',
	Spe: 'spe', Spd: 'spe', spe: 'spe'
};

// Returns an array of sets. Input: PS importable.
function parseText (text) {
	var teams = [];
	var text = text.split('\n');
	var curSet = null;
	for (var i = 0; i < text.length; i++) {
		var line = text[i].trim();
		if (line === '' || line === '---') {
			curSet = null;
		} else if (line.slice(0, 3) === '===' && teams) {
			// Do nothing
		} else if (!curSet) {
			curSet = {species: '', gender: ''};
			teams.push(curSet);
			var atIndex = line.lastIndexOf(' @ ');
			if (atIndex !== -1) {
				curSet.item = line.slice(atIndex + 3);
				if (toId(curSet.item) === 'noitem') curSet.item = '';
				line = line.slice(0, atIndex);
			}
			if (line.slice(line.length - 4) === ' (M)') {
				curSet.gender = 'M';
				line = line.slice(0, -4);
			}
			if (line.slice(line.length - 4) === ' (F)') {
				curSet.gender = 'F';
				line = line.slice(0, -4);
			}
			var parenIndex = line.lastIndexOf(' (');
			if (line.slice(-1) === ')' && parenIndex !== -1) {
				line = line.slice(0, -1);
				curSet.species = Tools.getTemplate(line.slice(parenIndex + 2)).name;
			} else {
				curSet.species = Tools.getTemplate(line).name;
			}
		} else if (line.slice(0, 7) === 'Trait: ') {
			line = line.slice(7);
			curSet.ability = line;
		} else if (line.slice(0, 9) === 'Ability: ') {
			line = line.slice(9);
			curSet.ability = line;
		} else if (line === 'Shiny: Yes') {
			curSet.shiny = true;
		} else if (line.slice(0, 7) === 'Level: ') {
			line = line.slice(7);
			curSet.level = +line;
		} else if (line.slice(0, 11) === 'Happiness: ') {
			line = line.slice(11);
			curSet.happiness = +line;
		} else if (line.slice(0, 9) === 'Ability: ') {
			line = line.slice(9);
			curSet.ability = line;
		} else if (line.slice(0, 5) === 'EVs: ') {
			line = line.slice(5);
			var evLines = line.split('/');
			curSet.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
			for (var j = 0; j < evLines.length; j++) {
				var evLine = evLines[j].trim();
				var spaceIndex = evLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				var statid = BattleStatIDs[evLine.slice(spaceIndex + 1)];
				var statval = parseInt(evLine.slice(0, spaceIndex), 10);
				if (!statid) continue;
				curSet.evs[statid] = statval;
			}
		} else if (line.slice(0, 5) === 'IVs: ') {
			line = line.slice(5);
			var ivLines = line.split('/');
			curSet.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
			for (var j = 0; j < ivLines.length; j++) {
				var ivLine = ivLines[j].trim();
				var spaceIndex = ivLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				var statid = BattleStatIDs[ivLine.slice(spaceIndex + 1)];
				var statval = parseInt(ivLine.slice(0, spaceIndex), 10);
				if (!statid) continue;
				curSet.ivs[statid] = statval;
			}
		} else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
			var natureIndex = line.indexOf(' Nature');
			if (natureIndex === -1) natureIndex = line.indexOf(' nature');
			if (natureIndex === -1) continue;
			line = line.slice(0, natureIndex);
			curSet.nature = line;
		} else if (line.charAt(0) === '-' || line.charAt(0) === '~') {
			line = line.slice(1);
			if (line.charAt(0) === ' ') line = line.slice(1);
			if (!curSet.moves) curSet.moves = [];
			curSet.moves.push(line.split(/\s*\/\s*/g));
		}
	}
	return teams;
}

function readTierFile (tier) {
	return '' + fs.readFileSync('./data/' + tier.toLowerCase() + '.txt');
}

function isValidMove (move) {
	return Tools.data.Movedex.hasOwnProperty(toId(move));
}

function proofRead (setLists) {
	var errors = [];
	var sets = {};

	for (var tier in setLists) {
		var minTierIndex = tierPositions[tier];

		for (var speciesid in setLists[tier]) {
			if (!Pokedex.hasOwnProperty(speciesid)) {
				errors.push("Invalid species id: " + speciesid);
			} else if (tierPositions[Tools.getTemplate(speciesid).tier] < minTierIndex) {
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
		if (!inValues(Pokedex[speciesid].abilities, set.ability)) errors.push("Invalid ability for " + speciesid + ": '" + set.ability + "'.");
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
							setsImplied.push({ivs: cloneObj(Tools.getType(hpType).HPivs), move: moveOption});
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
				var setClone = deepCloneSet(set);
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
		setListsRaw[factoryTiers[i]] = parseText(fileContents[i]);
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
