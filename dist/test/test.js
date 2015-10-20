'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _tape = require('tape');

var _tape2 = _interopRequireDefault(_tape);

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _indexJs = require('../../index.js');

var _indexJs2 = _interopRequireDefault(_indexJs);

var _packageJson = require('../../package.json');

var atImport = require("postcss-import");
var nested = require("postcss-nested");

var tests = [{
    message: 'should match requested selector',
    fixture: '@reference{ header { color: blue; display: block; } } header { @references header; display: block; margin: 1em; }',
    expected: 'header { color: blue; display: block; margin: 1em; }'
}, {
    message: "should merge duplicate selectors' declarations into single rule",
    fixture: '@reference { header { color: blue; display: block; } header { border: 1px solid black; } } header { @references header; display: block; margin: 1em; }',
    expected: 'header { color: blue; border: 1px solid black; display: block; margin: 1em; }'
}, {
    message: 'non-matching selectors in selector list get discarded',
    fixture: '@reference { header, section { padding: 0; } } header { @references header; display: block; margin: 1em; }',
    expected: 'header { padding: 0; display: block; margin: 1em; }'
}, {
    message: '@import files into the @reference block and extend rules from inside',
    fixture: '@reference{ @import "test/imports/header.css" } header { @references header; display: block; margin: 1em; }',
    expected: 'header { color: blue; padding: 0; box-sizing: border-box; width: 100%; display: block; margin: 1em; }'
}, {
    message: 'referenced selectors which contain nested selectors (using postcss-nested) and have the "all" flag set, will have their nested rules inserted after the requesting rule',
    fixture: '@reference { header { color: blue; display: block; aside { width: 25%; } } } header { @references header all; display: block; margin: 1em; }',
    expected: 'header { color: blue; display: block; margin: 1em; }\nheader aside { width: 25%; }'
}, {
    message: 'With no params declared, a referencing rule not wrapped in a media query will only match selectors also not wrapped in a media query',
    fixture: '@reference { article { width: 100%;} @media (min-width: 900px) { article { width: 75%; } } } article { display: block; @references article; }',
    expected: 'article { display: block; width: 100%; }'
}, {
    message: 'With the all flag set, a referencing rule not wrapped in a media query will match the rule&#39;s selector at any defined media query',
    fixture: '@reference { article { width: 100%;} @media (min-width: 900px) { article { width: 75%; } } } article { display: block; @references article all; }',
    expected: 'article { display: block; width: 100%; } @media (min-width: 900px) { article { width: 75%; } }'
}, {
    message: 'referencing selectors from inside a media query should result in the match of the selector in only that media query',
    fixture: '@reference { article { width: 100%; @media (min-width: 900px) { width: 75%; } } } article { @media (min-width: 900px) { display: block; @references article; } }',
    expected: 'article { display: block; width: 100%; } @media (min-width: 900px) { article { width: 75%; } }'
}, {
    message: 'if a specific media query is specified as a param when refencing, only match for requested the media query regardless of the requesting rule&#39s media query is',
    fixture: '@reference { article { width: 100%; @media (min-width: 900px) { width: 75%; } } } article { @media (min-width: 900px) { display: block; @references article; } }',
    expected: 'article { display: block; width: 100%; } @media (min-width: 900px) { article { width: 75%; } }'
}];

function process(css, options) {
    return (0, _postcss2['default'])().use(atImport()).use(nested()).use((0, _indexJs2['default'])(options)).process(css).css;
}

(0, _tape2['default'])(_packageJson.name, function (t) {
    t.plan(tests.length);

    tests.forEach(function (test) {
        var options = test.options || {};
        t.equal(process(test.fixture, options), test.expected, test.message);
    });
});

(0, _tape2['default'])('should use the postcss plugin api', function (t) {
    t.plan(2);
    t.ok((0, _indexJs2['default'])().postcssVersion, 'should be able to access version');
    t.equal((0, _indexJs2['default'])().postcssPlugin, _packageJson.name, 'should be able to access name');
});