import * as csstree from 'css-tree';
import {
  isDeclaration,
  isPseudoElementSelector,
  isRule,
  isSelector,
} from './style-types';
import {
  VIEW_TRANSITION_ELEMENTS,
  ATRULES,
  getElementSelector,
  replaceDeclarations,
  generateListItem,
} from './parsing-utils';

function removeNonPolyfillCSS(ast: csstree.CssNode) {
  // Remove most CSS from a stylesheet that is not relevant for view transitions.
  // This means we only care about:
  //  - any rule with a view transition pseudo element selector, like ::view-transition ()
  //  - any rule whose block contains the view-transition-name property

  // Recursive functions used to clear irrelevant CSS
  const nestedRulesHaveName = (node: csstree.Rule): boolean => {
    return node.block.children.some((node) => {
      if (isRule(node)) return nestedRulesHaveName(node);
      return isDeclaration(node) && node.property === 'view-transition-name';
    });
  };
  const clearIrrelevantProperties = (node: csstree.Rule) => {
    node.block.children.forEach((node, item, list) => {
      if (isDeclaration(node) && node.property === 'view-transition-name')
        return;
      if (isRule(node)) {
        clearIrrelevantProperties(node);
        return;
      }
      list.remove(item);
    });
  };

  csstree.walk(ast, {
    visit: 'Rule',
    enter(node, item, list) {
      if (this.atrule && !ATRULES.includes(this.atrule.name)) {
        // Skip at-rules that contain blocks we don't want to touch, like @keyframes.
        return;
      }
      const hasTransitionName = node.block.children.some((node) => {
        return isDeclaration(node) && node.property === 'view-transition-name';
      });
      const isPseudoElRule = (
        node.prelude as csstree.SelectorList
      ).children.some((selector) => {
        if (!isSelector(selector)) return false;
        return selector.children.some((selectorPart) => {
          return (
            isPseudoElementSelector(selectorPart) &&
            VIEW_TRANSITION_ELEMENTS.includes(selectorPart.name)
          );
        });
      });
      if (!hasTransitionName && !isPseudoElRule) {
        // Check that there aren't any nested rules with view-transition-name
        const hasNestedName = nestedRulesHaveName(node);
        if (hasNestedName) {
          // Only delete declarations, not nested rules
          node.block.children.forEach((node, item, list) => {
            if (isDeclaration(node)) list.remove(item);
          });
          return;
        }
        list.remove(item);
        return;
      }
      if (hasTransitionName) {
        clearIrrelevantProperties(node);
      }
    },
  });
}

function replaceSelectors(ast: csstree.CssNode) {
  // Find view transition pseudo element selectors
  // ::view-transition, ::view-transition-group(),
  // ::view-transition-image-pair(), ::view-transition-old(),
  // ::view-transition-new()

  // Two conditions, one in visit option for possible performance gains
  csstree.walk(ast, {
    visit: 'PseudoElementSelector',
    enter(node, item, list) {
      if (VIEW_TRANSITION_ELEMENTS.includes(node.name)) {
        const selector = node;

        if (selector.name === 'view-transition') {
          if (selector.children) {
            // Parse error: ::view-transition should not have parentheses
            console.warn(
              `View Transition API polyfill, CSS parse error: ::view-transition should not have parentheses. ${node.loc ? `Source: ${node.loc.source}; Line: ${node.loc.start.line}; Column: ${node.loc.start.column}` : ''}`
            );
          }
        }
        // Replace pseudo-element selector in AST with custom element selector
        const newSelector = getElementSelector(node);
        list.replace(item, generateListItem(newSelector));
      }
    },
  });
  return ast;
}

export default function parseStyleString(styleString: string): string {
  // Given a CSS stylesheet, output a new stylesheet
  //  (as a string, to be put inside a <style> element)
  //  which has had its pseudo elements and transition properties
  //  replaced with ones understood by the polyfill.

  const parserOptions: csstree.ParseOptions = {
    // The only detailed things needed are rule preludes (may contain ::view-transition pseudo elements)
    // The values for view-transition-name can just be raw, they do not need to be dissected.
    parseAtrulePrelude: false,
    parseValue: false,
    parseCustomProperty: false,
    positions: true,
  };
  const parsed = csstree.parse(styleString, parserOptions);
  removeNonPolyfillCSS(parsed);
  replaceSelectors(parsed);
  replaceDeclarations(parsed);
  const newStyleString = csstree.generate(parsed);
  return newStyleString;
}
