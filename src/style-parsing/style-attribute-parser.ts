import * as csstree from 'css-tree';
import {
  isDeclaration,
  isIdentifier,
  isPseudoElementSelector,
  isValue,
} from './style-types';
import {
  getElementSelector,
  generateListItem,
  VIEW_TRANSITION_ELEMENTS,
  replaceDeclarations,
} from './parsing-utils';

export function getSerializedElementSelector(
  pseudoElementSelector: string
): string {
  const ast = csstree.parse(pseudoElementSelector, { context: 'selector' });
  const pseudoAST = csstree.find(
    ast,
    (node) =>
      isPseudoElementSelector(node) &&
      VIEW_TRANSITION_ELEMENTS.includes(node.name)
  ) as csstree.PseudoElementSelector | null;
  if (!pseudoAST) {
    throw new Error(
      `View Transitions API polyfill: invalid pseudo-element selector given: ${pseudoElementSelector}`
    );
  }
  const selectorAST = getElementSelector(pseudoAST);
  return csstree.generate(selectorAST);
}

function isValidValue(valueAST: csstree.Value): boolean {
  // Parse the value of view-transition-name (from the value itself), which must be one <custom-ident> in CSS
  const plainObject = csstree.toPlainObject(valueAST) as csstree.ValuePlain;
  const childrenArray = plainObject.children;
  if (childrenArray.length !== 1) return false;
  if (!isIdentifier(childrenArray[0])) return false;
  return true;
}

function getNameValue(valueAST: csstree.Declaration): string {
  // Parse the value of view-transition-name, which must be one <custom-ident> in CSS
  const plainObject = csstree.toPlainObject(
    valueAST
  ) as csstree.DeclarationPlain;
  const childrenArray = (plainObject.value as csstree.ValuePlain).children;
  if (childrenArray.length !== 1) return '';
  if (!isIdentifier(childrenArray[0])) return '';
  return childrenArray[0].name;
}

export function getFromStyleAttribute(styleAttribute: string): string {
  // Given the style="" HTML attribute of an element,
  //  get the value of view-transition-name
  const ast = csstree.parse(styleAttribute, {
    context: 'declarationList',
    parseCustomProperty: true,
  });
  // Replace view-transition-name declarations with --vt-polyfill-name
  replaceDeclarations(ast);
  const lastDeclaration = csstree.findLast(
    ast,
    (node) => isDeclaration(node) && node.property === '--vt-polyfill-name'
  ) as csstree.Declaration | null;
  if (!lastDeclaration) return '';
  return getNameValue(lastDeclaration);
}

export function setStyleAttribute(
  styleAttribute: string,
  value: string
): string {
  // Given the style="" HTML attribute of an element,
  //  get what style="" should be if view-transition name is set
  const ast = csstree.parse(styleAttribute, {
    context: 'declarationList',
    parseCustomProperty: true,
  }) as csstree.DeclarationList;
  // Normalize view-transition-name declarations to --vt-polyfill-name
  replaceDeclarations(ast);

  const declarations = csstree.findAll(
    ast,
    (node) => isDeclaration(node) && node.property === '--vt-polyfill-name'
  ) as csstree.Declaration[];

  if (value === '') {
    // Remove any declarations
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node, item, list) {
        if (node.property === '--vt-polyfill-name') {
          list.remove(item);
        }
      },
    });

    const serializedAttribute = csstree.generate(ast);
    return serializedAttribute;
  }

  if (declarations.length >= 2) {
    // Remove all declarations except for the last one
    const lastDeclaration = declarations[declarations.length - 1];
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node, item, list) {
        if (
          node.property === '--vt-polyfill-name' &&
          node !== lastDeclaration
        ) {
          list.remove(item);
        }
      },
    });
  }

  if (declarations.length === 1) {
    const lastDeclaration = declarations[declarations.length - 1];
    // Create new csstree.Value object
    const valueAST = csstree.parse(value, { context: 'value' });
    const valueTree = csstree.find(valueAST, (node) =>
      isValue(node)
    ) as csstree.Value | null;
    // Early exit: return styleAttribute as-is to avoid modifications
    if (!valueTree || !isValidValue(valueTree)) return styleAttribute;

    const valueItem = generateListItem(valueTree);
    (lastDeclaration.value as csstree.Value).children.clear();
    (lastDeclaration.value as csstree.Value).children.append(valueItem);

    const serializedAttribute = csstree.generate(ast);
    return serializedAttribute;
  } else {
    // Create new csstree.Declaration object
    const serialized = `--vt-polyfill-name: ${value}`;
    const valueAST = csstree.parse(serialized, {
      context: 'declaration',
      parseCustomProperty: true,
    });
    const declaration = csstree.find(
      valueAST,
      (node) => isDeclaration(node) && node.property === '--vt-polyfill-name'
    ) as csstree.Declaration | null;
    // Early exit: return styleAttribute as-is to avoid modifications
    if (!declaration || !isValidValue(declaration.value as csstree.Value))
      return styleAttribute;

    // Get declaration as a list item to be appended to style attribute
    const declarationItem = generateListItem(declaration);
    ast.children.append(declarationItem);
  }

  const serializedAttribute = csstree.generate(ast);
  return serializedAttribute;
}
