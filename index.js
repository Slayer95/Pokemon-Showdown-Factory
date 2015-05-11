var fs = require('fs');

require('./Pokemon-Showdown');
var Tools = global.Tools;

// Generic helper functions

function cloneObj (obj) {
	var clone = {};
	for (var key in obj) {
		clone[key] = obj[key];
	}
	return clone;
}

function inValues (obj, val) {
	for (var key in obj) {
		if (obj[key] === val) return true;
	}
	return false;
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
			var ivLines = line.split(' / ');
			curSet.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
			for (var j = 0; j < ivLines.length; j++) {
				var ivLine = ivLines[j];
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
			if (line.slice(0, 14) === 'Hidden Power [') {
				var hpType = line.slice(14, -1);
				line = 'Hidden Power ' + hpType;
				if (!curSet.ivs) curSet.ivs = cloneObj(Tools.getType(hpType).HPivs);
			}
			if (line === 'Frustration') {
				curSet.happiness = 0;
			}
			curSet.moves.push(line);
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
	var Pokedex = Tools.data.Pokedex;
	var Items = Tools.data.Items;
	var Natures = Tools.data.Natures;

	var tierList = ['Uber', 'OU', 'BL', 'UU', 'BL2', 'RU', 'BL3', 'NU'];
	var tierPosition = {};
	for (var i = 0; i < tierList.length; i++) {
		tierPosition[tierList[i]] = i;
	}

	for (var tier in setLists) {
		var minTierIndex = tierPosition[tier];
		for (var speciesid in setLists[tier]) {
			if (!Pokedex[speciesid]) console.error("Invalid species id: " + speciesid);
			for (var i = 0; i < setLists[tier][speciesid].length; i++) {
				var set = setLists[tier][speciesid][i];
				if (set.item && !Items.hasOwnProperty(toId(set.item))) console.error("Invalid item for " + speciesid + ": " + set.item);
				if (set.nature && !Natures.hasOwnProperty(toId(set.nature))) console.error("Invalid nature for " + speciesid + ": " + set.nature);
				if (!set.moves.every(isValidMove)) console.error("Invalid moveset for " + speciesid + ": " + JSON.stringify(set.moves));
				if (!inValues(Pokedex[speciesid].abilities, set.ability)) console.error("Invalid ability for " + speciesid + ": '" + set.ability + "'");
				if (tierPosition[Tools.getTemplate(speciesid).tier] < minTierIndex) console.error("Pokémon " + speciesid + " is banned from " + tier);
			}
		}
	}
}

function buildSets () {
	var setListsRaw = {};
	var setListsByTier = {};

	var allTiers = ['Uber', 'OU', 'UU', 'RU', 'NU'];
	var fileContents = allTiers.map(readTierFile);

	for (var i = 0; i < allTiers.length; i++) {
		setListsRaw[allTiers[i]] = parseText(fileContents[i]);
		setListsByTier[allTiers[i]] = {};
	}

	// Classify sets according to tier and species
	for (var tier in setListsRaw) {
		var viableSets = setListsByTier[tier];
		for (var i = 0, len = setListsRaw[tier].length; i < len; i++) {
			var set = setListsRaw[tier][i];
			var speciesid = toId(set.species);
			if (!viableSets[speciesid]) viableSets[speciesid] = [];
			viableSets[speciesid].push(set);
		}
	}

	// Check for weird stuff
	proofRead(setListsByTier);

	// Export as JSON
	fs.writeFileSync('./factory-sets.json', JSON.stringify(setListsByTier) + '\n');

	console.log("Battle factory sets built");
}

// Do it!
buildSets();
