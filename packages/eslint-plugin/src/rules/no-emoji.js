import { findEmoji } from '../utils.js';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'No emojis in the interface; use Lucide line icons instead.' },
    messages: {
      emoji: 'Emoji "{{emoji}}" en la interfaz. Usá un ícono de Lucide (lucide-react).',
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      const emoji = findEmoji(text);
      if (emoji) context.report({ node, messageId: 'emoji', data: { emoji } });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? '');
      },
      JSXText(node) {
        check(node, node.value);
      },
    };
  },
};
