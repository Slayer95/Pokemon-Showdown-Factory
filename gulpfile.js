var gulp = require('gulp');
var jscs = require('gulp-jscs');
var jshint = require('gulp-jshint');
var jshintStylish = require('jshint-stylish');

var jsHintOptions = {
	"nonbsp": true,
	"nonew": true,
	"noarg": true,
	"loopfunc": true,
	"latedef": 'nofunc',

	"freeze": true,
	"undef": true,
	"shadow": true,

	"sub": true,
	"evil": true,
	"esnext": true,
	"node": true,
	"eqeqeq": true,

	"mocha": true
};

var jscsOptions = {
	"preset": "yandex",

	"additionalRules": [
		new (require('./Pokemon-Showdown/dev-tools/jscs-custom-rules/validate-conditionals.js'))(),
		new (require('./Pokemon-Showdown/dev-tools/jscs-custom-rules/validate-case-indentation.js'))()
	],
	"validateConditionals": true,
	"validateCaseIndentation": true,

	"requireCurlyBraces": null,

	"maximumLineLength": null,
	"validateIndentation": '\t',
	"validateQuoteMarks": null,
	"disallowYodaConditions": null,
	"disallowQuotedKeysInObjects": null,
	"requireDotNotation": null,

	"disallowMultipleVarDecl": null,
	"disallowImplicitTypeConversion": null,
	"requireSpaceAfterLineComment": null,
	"validateJSDoc": null,

	"disallowMixedSpacesAndTabs": "smart",
	"requireSpaceAfterKeywords": true,

	"disallowSpacesInFunctionDeclaration": null,
	"requireSpacesInFunctionDeclaration": {
		"beforeOpeningCurlyBrace": true
	},
	"requireSpacesInAnonymousFunctionExpression": {
		"beforeOpeningRoundBrace": true,
		"beforeOpeningCurlyBrace": true
	},
	"disallowSpacesInNamedFunctionExpression": null,
	"requireSpacesInNamedFunctionExpression": {
		"beforeOpeningCurlyBrace": true
	},
	"validateParameterSeparator": ", ",

	"requireBlocksOnNewline": 1,
	"disallowPaddingNewlinesInBlocks": true,

	"requireOperatorBeforeLineBreak": true,
	"disallowTrailingComma": true,

	"requireCapitalizedConstructors": true,

	"validateLineBreaks": require('os').EOL === '\n' ? 'LF' : null,
	"disallowMultipleLineBreaks": null,

	"esnext": true
};

function lint () {
	return gulp.src(['./*.js', './test/**/*.js'])
		.pipe(jshint(jsHintOptions))
		.pipe(jscs(jscsOptions))
		.pipe(jshint.reporter(jshintStylish))
		.pipe(jshint.reporter('fail'));
}

gulp.task('lint', lint);
gulp.task('default', lint);
