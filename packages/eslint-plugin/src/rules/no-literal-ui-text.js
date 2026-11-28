import { attributeName, hasLetter } from '../utils.js';

const TEXT_PROPS = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'caption',
  'description',
  'emptyText',
  'error',
  'heading',
  'helperText',
  'hint',
  'label',
  'placeholder',
  'subtitle',
  'title',
  'tooltip',
]);

/** Strings a JSX expression renders directly (not the ones passed to calls such as `t()`). */
function renderedStrings(expression) {
  if (!expression) return [];
  switch (expression.type) {
    case 'Literal':
      return typeof expression.value === 'string' ? [expression] : [];
    case 'TemplateLiteral':
      return expression.quasis;
    case 'ConditionalExpression':
      return [...renderedStrings(expression.consequent), ...renderedStrings(expression.alternate)];
    case 'LogicalExpression':
      return [...renderedStrings(expression.left), ...renderedStrings(expression.right)];
    default:
      return [];
  }
}

function textOf(node) {
  return node.type === 'TemplateElement' ? (node.value.cooked ?? '') : node.value;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'User-facing text goes in packages/shared/i18n/es-PY.json and is rendered with t(), never written in a component.',
    },
    messages: {
      literal:
        'Texto visible escrito en el código: "{{text}}". Movelo a packages/shared/i18n/es-PY.json y usá t(\'clave\').',
    },
    schema: [],
  },
  create(context) {
    const report = (node, text) =>
      context.report({ node, messageId: 'literal', data: { text: text.trim().slice(0, 40) } });

    return {
      JSXText(node) {
        if (hasLetter(node.value)) report(node, node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent.type === 'JSXAttribute') return;
        for (const piece of renderedStrings(node.expression)) {
          if (hasLetter(textOf(piece))) report(piece, textOf(piece));
        }
      },
      JSXAttribute(node) {
        if (!TEXT_PROPS.has(attributeName(node) ?? '') || !node.value) return;
        const candidates =
          node.value.type === 'JSXExpressionContainer'
            ? renderedStrings(node.value.expression)
            : [node.value];
        for (const piece of candidates) {
          if (hasLetter(textOf(piece))) report(piece, textOf(piece));
        }
      },
    };
  },
};
