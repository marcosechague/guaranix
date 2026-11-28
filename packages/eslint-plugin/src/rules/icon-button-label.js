import { elementName, findAttribute } from '../utils.js';

const BUTTONS = new Set(['button', 'Button', 'IconButton', 'a', 'Link']);
const LABELS = ['aria-label', 'aria-labelledby', 'title'];

function hasReadableChild(children) {
  return children.some((child) => {
    if (child.type === 'JSXText') return child.value.trim() !== '';
    if (child.type === 'JSXExpressionContainer') {
      return child.expression.type !== 'JSXEmptyExpression';
    }
    if (child.type === 'JSXElement') {
      // `<span className="sr-only">…</span>` and nested text count as a name.
      return hasReadableChild(child.children);
    }
    return child.type === 'JSXFragment' && hasReadableChild(child.children);
  });
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Icon-only buttons and links need an aria-label.' },
    messages: {
      missing: "Botón o link de solo ícono sin nombre accesible. Agregá aria-label={t('…')}.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (!BUTTONS.has(elementName(opening))) return;
        if (opening.attributes.some((attribute) => attribute.type === 'JSXSpreadAttribute')) return;
        if (LABELS.some((label) => findAttribute(opening, label))) return;
        // IconButton takes a required `label` and turns it into aria-label itself.
        if (elementName(opening) === 'IconButton' && findAttribute(opening, 'label')) return;
        if (findAttribute(opening, 'asChild')) return;
        if (node.children.length === 0 || hasReadableChild(node.children)) return;
        context.report({ node: opening, messageId: 'missing' });
      },
    };
  },
};
