var child_process = require('child_process');
var path = require('path');
var targetDir = path.normalize(process.cwd() + '/Pokemon-Showdown');

child_process.exec('npm install --production', {cwd: targetDir}, function (err, stdout, stderr) {
	if (error) console.error(error.stack);
	console.log("" + stdout + stderr);
});
