import { elementName, findAttribute, isIntrinsic } from '../utils.js';

const REPLACEMENTS = {
  button: 'Button',
  input: 'TextField',
  select: 'un componente Select en packages/ui',
  textarea: 'un componente TextArea en packages/ui',
  dialog: 'un componente Dialog en packages/ui (Radix)',
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Apps build screens from packages/ui components instead of styling raw form controls again.',
    },
    messages: {
      raw: '<{{element}}> suelto en una app. Usá {{replacement}} de @guaranix/ui (si no existe, crealo ahí).',
      style:
        'Estilo en línea (style) en una app. Usá clases de Tailwind con los tokens de packages/ui, o un componente de ahí.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!isIntrinsic(node)) return;
        const element = elementName(node);
        const replacement = REPLACEMENTS[element];
        if (replacement) {
          context.report({ node, messageId: 'raw', data: { element, replacement } });
        }
        const style = findAttribute(node, 'style');
        if (style) context.report({ node: style, messageId: 'style' });
      },
    };
  },
};
