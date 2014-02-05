define([
  'lodash-modern/arrays/last',
  'lodash-modern/collections/contains',
], function (
  last,
  contains
) {

  'use strict';

  return function () {
    return function (scribe) {
      // TODO: not exhaustive?
      var blockElementNames = ['P', 'LI', 'DIV', 'BLOCKQUOTE', 'UL', 'OL', 'H2'];
      function isBlockElement(node) {
        return contains(blockElementNames, node.nodeName);
      }

      var insertHTMLCommand = new scribe.api.Command('insertHTML');

      insertHTMLCommand.execute = function (value) {
        if (scribe.allowsBlockElements()) {
          /**
           * Ensure P mode.
           *
           * Wrap any orphan text nodes in a P element.
           */
          // TODO: This should be configurable and also correct markup such as
          // `<ul>1</ul>` to <ul><li>2</li></ul>`. See skipped tests.
          // TODO: This should probably be a part of HTML Janitor, or some other
          // formatter.
          scribe.transactionManager.run(function () {
            var bin = document.createElement('div');
            bin.innerHTML = value;

            wrapChildNodes(bin);
            traverse(bin);

            var newValue = bin.innerHTML;

            scribe.api.Command.prototype.execute.call(this, newValue);

            /**
             * Wrap consecutive inline elements and text nodes in a P element.
             */
            function wrapChildNodes(parentNode) {
              var groups = Array.prototype.reduce.call(parentNode.childNodes, function (accumulator, binChildNode) {
                var group = last(accumulator);
                var isFirstGroup = accumulator.length === 1;
                var isEmptyGroup = group.length === 0;
                var isBlockGroup = ! isEmptyGroup && isBlockElement(group[0]);
                if (isFirstGroup && isEmptyGroup || isBlockGroup === isBlockElement(binChildNode)) {
                  group.push(binChildNode);
                } else {
                  var newGroup = [];
                  accumulator.push(newGroup);
                  newGroup.push(binChildNode);
                }
                return accumulator;
              }, [[]]);

              var consecutiveInlineElementsAndTextNodes = groups.filter(function (group) {
                var isEmptyGroup = group.length === 0;
                var isBlockGroup = ! isEmptyGroup && isBlockElement(group[0]);
                return ! isBlockGroup;
              }).filter(function (nodes) {
                // Remove empty groups
                return nodes.length;
              });

              consecutiveInlineElementsAndTextNodes.forEach(function (nodes) {
                var pElement = document.createElement('p');
                nodes[0].parentNode.insertBefore(pElement, nodes[0]);
                nodes.forEach(function (node) {
                  pElement.appendChild(node);
                });
              });

              parentNode._isWrapped = true;
            }

            // Traverse the tree, wrapping child nodes as we go.
            function traverse(parentNode) {
              var treeWalker = document.createTreeWalker(parentNode, NodeFilter.SHOW_ELEMENT);
              var node = treeWalker.firstChild();

              while (node) {
                // TODO: At the moment we only support BLOCKQUOTEs. See failing
                // tests.
                if (node.nodeName === 'BLOCKQUOTE' && ! node._isWrapped) {
                  wrapChildNodes(node);
                  traverse(parentNode);
                  break;
                }
                node = treeWalker.nextSibling();
              }
            }
          }.bind(this));
        } else {
          scribe.api.Command.prototype.execute.call(this, value);
        }
      };

      scribe.commands.insertHTML = insertHTMLCommand;
    };
  };

});
