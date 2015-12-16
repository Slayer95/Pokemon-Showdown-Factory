"use strict";

const toId = global.toId;
const Tools = global.Tools;
const utils = require('./utils.js');
const statIDs = utils.statIDs;

// Mostly from https://github.com/Zarel/Pokemon-Showdown-Client/blob/2a6a2667a751f/js/storage.js#L262
module.exports = function parseTeams(text) {
	const teams = [];
	const lines = text.split('\n');
	let curSet = null;
	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();
		if (line === '' || line === '---') {
			curSet = null;
		} else if (line.slice(0, 3) === '===' && teams) {
			// Do nothing
			continue;
		} else if (!curSet) {
			curSet = {species: '', gender: ''};
			teams.push(curSet);
			let atIndex = line.lastIndexOf(' @ ');
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
			let parenIndex = line.lastIndexOf(' (');
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
			curSet.level = parseInt(line, 10);
		} else if (line.slice(0, 11) === 'Happiness: ') {
			line = line.slice(11);
			curSet.happiness = parseInt(line, 10);
		} else if (line.slice(0, 9) === 'Ability: ') {
			line = line.slice(9);
			curSet.ability = line;
		} else if (line.slice(0, 5) === 'EVs: ') {
			line = line.slice(5);
			let evLines = line.split('/');
			curSet.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
			for (let j = 0; j < evLines.length; j++) {
				let evLine = evLines[j].trim();
				let spaceIndex = evLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				let statid = statIDs[evLine.slice(spaceIndex + 1)];
				let statval = parseInt(evLine.slice(0, spaceIndex), 10);
				if (!statid) continue;
				curSet.evs[statid] = statval;
			}
		} else if (line.slice(0, 5) === 'IVs: ') {
			line = line.slice(5);
			let ivLines = line.split('/');
			curSet.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
			for (let j = 0; j < ivLines.length; j++) {
				let ivLine = ivLines[j].trim();
				let spaceIndex = ivLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				let statid = statIDs[ivLine.slice(spaceIndex + 1)];
				let statval = parseInt(ivLine.slice(0, spaceIndex), 10);
				if (!statid) continue;
				curSet.ivs[statid] = statval;
			}
		} else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
			let natureIndex = line.indexOf(' Nature');
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
};
