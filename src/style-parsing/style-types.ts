import * as csstree from 'css-tree';

export function isPseudoElementSelector(
  selector: csstree.CssNodeCommon
): selector is csstree.PseudoElementSelector {
  return selector.type === 'PseudoElementSelector';
}
export function isRawNode(node: csstree.CssNodeCommon): node is csstree.Raw {
  return node.type === 'Raw';
}
export function isDeclaration(
  node: csstree.CssNodeCommon
): node is csstree.Declaration {
  return node.type === 'Declaration';
}
export function isIdentifier(
  node: csstree.CssNodeCommon
): node is csstree.Identifier {
  return node.type === 'Identifier';
}
export function isValue(node: csstree.CssNodeCommon): node is csstree.Value {
  return node.type === 'Value';
}
export function isSelector(
  node: csstree.CssNodeCommon
): node is csstree.Selector {
  return node.type === 'Selector';
}
export function isRule(node: csstree.CssNodeCommon): node is csstree.Rule {
  return node.type === 'Rule';
}
