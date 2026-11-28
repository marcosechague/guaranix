function property(object, name) {
  return object.properties.find(
    (candidate) =>
      candidate.type === 'Property' &&
      ((candidate.key.type === 'Identifier' && candidate.key.name === name) ||
        candidate.key.value === name),
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Cookies are HttpOnly, Secure and SameSite (CLAUDE.md, Seguridad).' },
    messages: {
      missing: 'setCookie sin {{option}}. Las cookies van con httpOnly: true, secure y sameSite.',
      disabled:
        'setCookie con {{option}}: false. Las cookies van con httpOnly: true, secure y sameSite.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'setCookie') return;
        const options = node.arguments[3];
        if (!options) {
          context.report({ node, messageId: 'missing', data: { option: 'opciones' } });
          return;
        }
        // Options built elsewhere can't be checked here; the security reviewer covers them.
        if (options.type !== 'ObjectExpression') return;
        for (const option of ['httpOnly', 'secure', 'sameSite']) {
          const found = property(options, option);
          if (!found) {
            context.report({ node: options, messageId: 'missing', data: { option } });
          } else if (found.value.type === 'Literal' && found.value.value === false) {
            context.report({ node: found, messageId: 'disabled', data: { option } });
          }
        }
      },
    };
  },
};
