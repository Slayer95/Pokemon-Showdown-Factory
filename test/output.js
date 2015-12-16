"use strict";

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const builder = require('./..');
const OutStream = require('./../utils.js').OutputStream;

describe("Builder", function () {
	describe("Output stream", function () {
		let streamWrite;

		beforeEach(function () {
			streamWrite = fs.WriteStream.prototype.write;
		});

		afterEach(function () {
			fs.WriteStream.prototype.write = streamWrite;
		});

		it('should not write to the file system if a custom output is provided', function (done) {
			fs.WriteStream.prototype.write = function () {throw new Error("Wrote to file stream");};
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers.txt')
				},
				output: new OutStream()
			}, done);
		});
	});

	describe("Output data", function () {
		it('should be a valid JSON string for an object', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers.txt')
				},
				output: new OutStream()
			}, function () {
				assert.ok(typeof this.setData === 'string');
				const parsedJSON = JSON.parse(this.setData);
				assert.ok(typeof parsedJSON === 'object' && !Array.isArray(parsedJSON));
				done();
			});
		});

		it('should consist of correct sets', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				assert.deepEqual(parsedJSON, {
					ubers: {
						klefki: {
							"flags": {},
							"sets": [{
								species: "Klefki", gender: "", item: "Leftovers", ability: "Prankster",
								evs: {"hp": 248, "atk": 8, "def": 0, "spa": 0, "spd": 252, "spe": 0}, nature: "Careful",
								moves: [["Spikes"], ["Thunder Wave"], ["Toxic"], ["Play Rough"]]
							}]
						},
						zekrom:  {
							"flags": {},
							"sets": [{
								species: "Zekrom", "gender": "", item: "Choice Band", ability: "Teravolt",
								evs: {"hp": 0, "atk": 252, "def": 0, "spa": 4, "spd": 0, "spe": 252}, nature: "Adamant",
								moves: [["Bolt Strike"], ["Outrage"], ["Dragon Claw"], ["Volt Switch"]]
							}, {
								species: "Zekrom", gender: "", item: "Choice Scarf", ability: "Teravolt",
								evs: {"hp": 0, "atk": 252, "def": 0, "spa": 4, "spd": 0, "spe": 252}, nature: "Lonely",
								moves: [["Bolt Strike"], ["Volt Switch"], ["Draco Meteor"], ["Outrage"]]
							}]
						}
					}
				});
				done();
			});
		});

		it('should parse sets with Hidden Power correctly', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-hiddenpower.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				assert.deepEqual(parsedJSON, {
					ubers: {
						xerneas: {
							"flags": {},
							"sets": [{
								species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
								evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
								ivs: {"spa":30, "spd":30},
								moves: [["Geomancy"], ["Moonblast"], ["Hidden Power Ground"], ["Thunder"]]
							}]
						}
					}
				});
				done();
			});
		});

		it('should parse sets with Frustration correctly', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-frustration.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				assert.deepEqual(parsedJSON, {
					ubers: {
						xerneas: {
							"flags": {},
							"sets": [{
								species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
								evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
								happiness: 0,
								moves: [["Geomancy"], ["Moonblast"], ["Frustration"], ["Thunder"]]
							}]
						}
					}
				});
				done();
			});
		});

		it('should parse sets with Hidden Power and Frustration correctly', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-hiddenpower-frustration.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				assert.deepEqual(parsedJSON, {
					ubers: {
						xerneas: {
							"flags": {},
							"sets": [{
								species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
								evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
								ivs: {"spa":30, "spd":30}, happiness: 0,
								moves: [["Geomancy"], ["Moonblast"], ["Hidden Power Ground"], ["Frustration"]]
							}]
						}
					}
				});
				done();
			});
		});

		it('should parse sets with options correctly', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-options.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				assert.deepEqual(parsedJSON, {
					ubers: {
						xerneas: {
							"flags": {},
							"sets": [{
								species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
								evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
								ivs: {"spa":30, "spd":30}, happiness: 0,
								moves: [["Geomancy"], ["Moonblast", "Dazzling Gleam"], ["Hidden Power Ground"], ["Frustration"]]
							}]
						}
					}
				});
				done();
			});
		});

		it('should parse sets with complex options correctly', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-options-complex.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				const expectedResults = {
					'Hidden Power Ground': {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [{
									species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
									evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
									ivs: {"spa":30, "spd":30},
									moves: [["Geomancy", "Reflect", "Light Screen"], ["Moonblast", "Dazzling Gleam"], ["Hidden Power Ground"], ["Thunder"]]
								}]
							}
						}
					},
					'Return': {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [{
									species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
									evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
									happiness: 255,
									moves: [["Geomancy", "Reflect", "Light Screen"], ["Moonblast", "Dazzling Gleam"], ["Return"], ["Thunder"]]
								}]
							}
						}
					},
					'Hidden Power Ice': {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [{
									species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
									evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
									ivs: {"atk":30, "def":30},
									moves: [["Geomancy", "Reflect", "Light Screen"], ["Moonblast", "Dazzling Gleam"], ["Hidden Power Ice"], ["Thunder"]]
								}]
							}
						}
					}
				};

				assert.ok(parsedJSON && parsedJSON.ubers && parsedJSON.ubers.xerneas && Array.isArray(parsedJSON.ubers.xerneas.sets));
				const sets = parsedJSON.ubers.xerneas.sets;
				for (let i = 0; i < sets.length; i++) {
					let thirdMoveAlts = sets[i].moves[2];
					assert.ok(Array.isArray(thirdMoveAlts));
					assert.deepEqual(expectedResults[thirdMoveAlts[0]], {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [
									sets[i]
								]
							}
						}
					});
				}
				done();
			});
		});

		it('should split off Defog', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-options-defog.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				const expectedResults = {
					'Defog': {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [{
									species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
									evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
									ivs: {"spa":30, "spd":30},
									moves: [["Geomancy", "Reflect", "Light Screen"], ["Moonblast", "Dazzling Gleam"], ["Hidden Power Ground"], ["Defog"]]
								}]
							}
						}
					},
					'Clear Smog': {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [{
									species: "Xerneas", gender: "", item: "Power Herb", ability: "Fairy Aura",
									evs: {"hp": 184, "atk": 0, "def": 28, "spa": 252, "spd": 0, "spe": 44}, nature: "Modest",
									ivs: {"spa":30, "spd":30},
									moves: [["Geomancy", "Reflect", "Light Screen"], ["Moonblast", "Dazzling Gleam"], ["Hidden Power Ground"], ["Clear Smog"]]
								}]
							}
						}
					}
				};

				assert.ok(parsedJSON && parsedJSON.ubers && parsedJSON.ubers.xerneas && Array.isArray(parsedJSON.ubers.xerneas.sets));
				const sets = parsedJSON.ubers.xerneas.sets;
				for (let i = 0; i < sets.length; i++) {
					let fourthMoveAlts = sets[i].moves[3];
					assert.ok(Array.isArray(fourthMoveAlts));
					assert.deepEqual(expectedResults[fourthMoveAlts[0]], {
						ubers: {
							xerneas: {
								"flags": {},
								"sets": [
									sets[i]
								]
							}
						}
					});
				}

				done();
			});
		});

		it('should tolerate duplicate moves and fix them', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-options-duplicate.txt')
				},
				output: new OutStream()
			}, function () {
				const parsedJSON = JSON.parse(this.setData);
				const expectedResults = {
					'Toxic': {
						ubers: {
							klefki: {
								"flags": {},
								"sets": [{
									"species": "Klefki", "gender": "", "item": "Leftovers", "ability": "Prankster",
									"evs": {"hp": 248, "atk": 8, "def": 0, "spa": 0, "spd": 252, "spe": 0},
									"nature": "Careful",
									"moves": [["Spikes"], ["Thunder Wave"], ["Light Screen"], ["Play Rough"]]
								}]
							}
						}
					},
					'Thunder Wave': {
						ubers: {
							klefki: {
								"flags": {},
								"sets": [{
									"species": "Klefki", "gender": "", "item": "Leftovers", "ability": "Prankster",
									"evs": {"hp": 248, "atk": 8, "def": 0, "spa": 0, "spd": 252, "spe": 0},
									"nature": "Careful",
									"moves": [["Spikes"], ["Toxic"], ["Light Screen"], ["Play Rough"]]
								}]
							}
						}
					},
					'Light Screen': {
						ubers: {
							klefki: {
								"flags": {},
								"sets": [{
									"species": "Klefki", "gender": "", "item": "Leftovers", "ability": "Prankster",
									"evs": {"hp": 248, "atk": 8, "def": 0, "spa": 0, "spd": 252, "spe": 0},
									"nature": "Careful",
									"moves": [["Spikes"], ["Thunder Wave"], ["Toxic"], ["Play Rough"]]
								}]
							}
						}
					}
				};

				assert.ok(parsedJSON && parsedJSON.ubers && parsedJSON.ubers.klefki && Array.isArray(parsedJSON.ubers.klefki.sets));
				const sets = parsedJSON.ubers.klefki.sets;
				for (let i = 0; i < sets.length; i++) {
					let moveSlice = sets[i].moves.slice(1, 3);
					assert.ok(Array.isArray(moveSlice[0]) && Array.isArray(moveSlice[1]));
					assert.deepEqual(Object.values(Object.reject(expectedResults, [moveSlice[0][0], moveSlice[1][0]]))[0], {
						ubers: {
							klefki: {
								"flags": {},
								"sets": [
									sets[i]
								]
							}
						}
					});
				}
				done();
			});
		});

		it('should reject sets with invalid combinations', function (done) {
			builder.run({
				setData: {
					ubers: path.resolve(__dirname, 'fixtures', 'sample-ubers-options-duplicate-invalid.txt')
				},
				output: new OutStream()
			}, function (err) {
				assert.ok(err);
				done();
			});
		});
	});
});
