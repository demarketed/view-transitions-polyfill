import * as csstree from 'css-tree';
import { isPseudoElementSelector, isRawNode } from './style-types';

export const VIEW_TRANSITION_ELEMENTS = [
  'view-transition',
  'view-transition-group',
  'view-transition-image-pair',
  'view-transition-old',
  'view-transition-new',
];

// CSS at-rules with blocks that could be relevant for view transitions
export const ATRULES = ['media', 'layer', 'container', 'scope', 'supports'];

export function getElementSelector(
  pseudoElementSelector: csstree.PseudoElementSelector
): csstree.Selector {
  // Transform a custom element selector string into an item to use in csstree
  //  to replace the corresponding pseudo-element

  // Separate (for example with group) the ::view-transition-group from the (view-transition-name)
  let pseudoElement = '';
  let parentheses = '';
  csstree.walk(pseudoElementSelector, {
    enter(node: csstree.CssNodeCommon) {
      if (isPseudoElementSelector(node)) {
        pseudoElement = node.name;
      } else if (
        isRawNode(node) &&
        (<csstree.WalkContext>this).root === pseudoElementSelector
      ) {
        parentheses = node.value;
      }
    },
  });

  const selectorString =
    parentheses !== '' && parentheses !== '*'
      ? `${pseudoElement}[name="${parentheses}"]`
      : pseudoElement;
  const selectorAST = csstree.parse(selectorString, {
    context: 'selector',
  }) as csstree.Selector;

  return selectorAST;
}

export function getNameDeclaration(
  declaration: csstree.Declaration
): csstree.ListItem<csstree.Declaration> {
  // Transform a view-transition-name declaration into --vt-polyfill-name.
  // This will be a ListItem such that it can be used for replacement in an AST.
  declaration.property = '--vt-polyfill-name';

  const declarationItem = generateListItem(declaration);
  return declarationItem;
}

export function generateListItem<T>(node: T): csstree.ListItem<T> {
  const list = new csstree.List();
  const nodeItem = list.createItem(node) as csstree.ListItem<T>;
  return nodeItem;
}

export function replaceDeclarations(ast: csstree.CssNode) {
  // Find view-transition-name declarations
  //  to replace them with --vt-polyfill-name,
  //  as that will be parsed by the polyfill is getComputedStyle()
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node, item, list) {
      if (node.property === 'view-transition-name') {
        const newDeclaration = getNameDeclaration(node);
        list.replace(item, newDeclaration);
      }
    },
  });
}
