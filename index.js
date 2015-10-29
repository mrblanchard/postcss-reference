var postcss = require('postcss');
var find = require('array-find');
var referenceableNodes = [];

module.exports = postcss.plugin('postcss-reference', function (opts) {
    opts = opts || {
        debug: false
    };

    var referenceRules = [];

    var testRelationExistsIn = function testSelectorExistsIn(ref, terms, prop) {
        var value = false;

        terms.forEach(function (term) {
            if (ref.indexOf(term[prop]) === 0) {
                value = true;
            }
        });

        return value;
    };

    var extractMatchingDecls = function extractMatchingDecls(matchArray, rule) {

        rule.walkDecls(function(decl) {
            var dup = null;

            // check for duplicates in our list of matches
            dup = findDuplicates(matchArray, decl, "prop");

            if (dup !== null) {
                // if it's a dupe, replace existing rule
                matchArray[dup].replaceWith(decl);
            } else {
                // otherwise add to the declarations list
                matchArray.push(decl);
            }
        });
    };

    var extractMatchingRelationships = function extractMatchingRelationships(matchArray, rule) {

        if (!matchArray.length) {
            matchArray.push(rule);
        } else {
            matchArray.forEach(function(match) {
                var dup = null;

                dup = findDuplicates(matchArray, rule, "selector");

                if (dup !== null) {
                    // walk through each decl in rule and discard all matching decls
                    // from dup before merging remaining decls
                    extractMatchingDecls(matchArray[dup].nodes, rule);
                } else {
                    // otherwise add to the declarations list
                    matchArray.push(rule);
                }
            });
        }
    };

    var extractMatchingMqs = function extractMatchingMqs(destination, source, mq) {
        find(destination, function (item, index, array) {
            if (item.mediaQuery === mq) {
                extractMatchingRelationships(destination[index].nodes, source);
            }
        });
    };

    var createMatchingMq = function createMatchingMq(destination, source, mq) {
        var newObj = {};
        newObj.mediaQuery = mq;
        newObj.nodes = [];
        destination.push(newObj);
        extractMatchingRelationships(destination[0].nodes, source);
    };

    var findDuplicates = function findDuplicates(matchArray, node, childParam) {
        var dup = null,
            matchRaws = "",
            nodeRaws = "";

        find(matchArray, function(match, index, array) {
            if (childParam === "prop") {
                if (match.raws && match.raws.before) {
                    matchRaws = match.raws.before.trim();
                }
                if (node.raws && node.raws.before) {
                    nodeRaws = node.raws.before.trim();
                }
            }

            if (matchRaws + match[childParam] === nodeRaws + node[childParam]) {
                dup = index;
            }
        });

        return dup;
    };

    var remapSelectors = function remapSelectors(refSelectors, reqSelector, term) {
        var refSelector;

        for (var i = 0; i < refSelectors.length; i++) {
            refSelectors[i] = refSelectors[i].selector.replace(term, reqSelector);
        }
        refSelector = refSelectors.join(', ');
        return refSelector;
    };

    var matchReferences = function matchReferences(referenceRules, node) {
        var matches,
            terms,
            processedTerms = [],
            reqMq = null,
            mqTestObj = node,
            mqsMatch = false;

        matches = {
            decls: [],
            relationships: [],
            mqRelationships: []
        };

        // extract our @references() contents and split selectors into an array
        terms = node.params.split(',');


        // terms and params are a string at this point.  Convert to an array of
        // well defined objects for cleaner processing
        terms.forEach(function(term) {
            var obj = {
                all: false,
                name: null
            };

            obj.all = (term.indexOf(" all") !== -1);
            // strip out any params from term now that flags are set
            // (only 'all' for now)
            term = term.replace(" all", '');

            // clean any whitespaces which might surround commas after param
            // extraction and assign the term to obj.name
            obj.name = term.trim();

            processedTerms.push(obj);
        });

        while (mqTestObj.parent.type !== "root") {
            if (mqTestObj.parent.type === "atrule" &&
                mqTestObj.parent.name === "media") {
                    reqMq = mqTestObj.parent.params;
                    break;
            } else {
                mqTestObj = mqTestObj.parent;
            }
        }

        for (var ref = 0; ref < referenceRules.length; ref++) {
            var refMq = null,
                reference = referenceRules[ref],
                matchedSelectorList = [];
                // reducedSelectorMatches = [];

            if (reference.parent.type === "atrule" &&
                reference.parent.name === "media") {
                    refMq = reference.parent.params;
            }

            mqsMatch = (reqMq === refMq);

            // Compare reference rule selectors against the resquested terms
            for (var sel = 0; sel < reference.selectors.length; sel++) {
                var selector = reference.selectors[sel];

                for (var term = 0; term < processedTerms.length; term++) {
                    var termObj = processedTerms[term],
                        safeChars = [" ", ".", "#", "+", "~", ">", ":"],
                        matchedSelector = {
                            selector: selector,
                            type: null
                        };

                    if (selector.indexOf(termObj.name) === 0) {
                        if (selector === termObj.name) {
                            matchedSelector.type = "exact";
                        } else if (selector.length > termObj.name.length &&
                            safeChars.indexOf(selector.charAt(termObj.name.length)) !== -1) {
                            matchedSelector.type = "relative";
                        }

                        if (matchedSelector.type !== null) {
                            matchedSelectorList.push(matchedSelector);
                        }
                    }
                }
            }

            if (matchedSelectorList.length && mqsMatch) {
                if (matchedSelectorList.length === 1 &&
                    matchedSelectorList[0].type === "exact") {
                        reference.selector = remapSelectors(matchedSelectorList, node.parent.selector, termObj.name);
                        extractMatchingDecls(matches.decls, reference);
                } else if (matchedSelectorList.length === 1 &&
                    matchedSelectorList[0].type === "relative" &&
                    termObj.all) {
                        reference.selector = remapSelectors(matchedSelectorList, node.parent.selector, termObj.name);
                        extractMatchingRelationships(matches.relationships, reference);
                } else if (matchedSelectorList.length > 1 && termObj.all) {
                    reference.selector = remapSelectors(matchedSelectorList, node.parent.selector, termObj.name);
                    extractMatchingRelationships(matches.relationships, reference);
                }
            } else if (matchedSelectorList.length &&
                !mqsMatch &&
                termObj.all &&
                reqMq === null) {
                    reference.selector = remapSelectors(matchedSelectorList, node.parent.selector, termObj.name);
                    if (!matches.mqRelationships.length) {
                        createMatchingMq(matches.mqRelationships, reference, refMq);
                    } else {
                        extractMatchingMqs(matches.mqRelationships, reference, refMq);
                    }
            }
        }

        return matches;
    };

    var sortResults = function sortResults(array) {
        // sort relationships alphabetically in descending order so
        // they will properly append after the original rule
        array.sort(function (a, b) {

            if (a < b) {
                return 1;
            }
            if (a > b) {
                return -1;
            }
            // a must be equal to b
            return 0;
        });
    };

    var removeComments = function removeComments(css) {
        css.walkComments(function (comment) {
            comment.remove();
        });
    };

    var findReferenceableRules = function findReferenceableRules(css) {
        // Walk through list of rules in @reference blocks, push them into the
        // referenceRules array and then remove them from the AST so they don't
        // get output to the compiled CSS unless matched.
        css.walkAtRules('reference', function(atRule) {
            if (atRule.parent.name === 'media') {
                console.log('found it');
            }
            atRule.walkRules(function(rule) {
                referenceRules.push(rule);
            });

            atRule.remove();
        });
    };

    var findReferences = function findReferences(css) {
        // Now that our @reference blocks have been processed
        // Walk through our rules looking for @references declarations
        css.walkRules(function(rule) {
            // TODO :: if rule's selector has a pseudoclass, prepend matches to
            // the rule

            rule.walk(function(node) {

                if (node.type === 'atrule' &&
                    node.name === 'references') {

                    // check our reference array for any of our terms
                    var matches = matchReferences(referenceRules, node);

                    // TODO :: spin this out into separate function so it can be reused for mqMatching
                    // if referenced and referencing rules have declarations
                    // with of same property, defer to the referencing rule
                    rule.walkDecls(function(decl) {
                        matches.decls.forEach(function(match, d, matchedDecls) {
                            if (decl.prop === match.prop) {
                                matchedDecls.splice(d, 1);
                            }
                        });
                    });

                    for (var m in matches.decls) {
                        // insertBefore appears to strip out raws utilized by css hacks like `*width`
                        matches.decls[m].prop = matches.decls[m].raws.before.trim() + matches.decls[m].prop;
                        rule.insertBefore(node, matches.decls[m]);
                    }

                    // sort results so they output in the original order referenced
                    if (matches.mqRelationships.length) {
                        sortResults(matches.mqRelationships, "params");
                    }

                    // TODO :: should be doing this in matchReferences when assembling matches array
                    matches.mqRelationships.forEach(function(mq) {
                        var targetAtRule;

                        targetAtRule = postcss.atRule({
                            name: "media",
                            params: mq.mediaQuery
                        });

                        for (var n = 0; n < mq.nodes.length; n++) {
                            var mqNode = mq.nodes[n];
                            targetAtRule.append(mqNode);
                        }

                        if (node.parent.type === 'rule') {
                            css.insertAfter(node.parent, targetAtRule);
                        } else {
                            css.insertAfter(node, targetAtRule);
                        }
                    });

                    // sort results so they output in the original order referenced
                    if (matches.relationships.length) {
                        sortResults(matches.relationships);
                    }

                    matches.relationships.forEach(function(newRule) {
                        css.insertAfter(rule, newRule);
                    });

                    node.remove();
                }
            });
        });
    };

    return function (css, result) {
        removeComments(css);
        findReferenceableRules(css);
        findReferences(css);
    };
});
