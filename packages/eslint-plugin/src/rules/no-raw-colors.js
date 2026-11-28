// A hex color as its own token (`#fff`, `bg-[#0E0F11]`), or a CSS color function.
export const RAW_COLOR =
  /(?:^|[\s"'`([:,=])(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8}))(?![\w-])|\b((?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\()/i;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Colors come from the design tokens in packages/ui (bg-surface, text-accent…), never written by hand.',
    },
    messages: {
      raw: 'Color escrito a mano ({{color}}). Usá un token de packages/ui/src/tokens (ej. bg-surface, text-accent).',
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      const match = RAW_COLOR.exec(text);
      if (match) {
        context.report({ node, messageId: 'raw', data: { color: match[1] ?? match[2] } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? '');
      },
    };
  },
};
