const METHODS = new Set(['all', 'delete', 'get', 'on', 'options', 'patch', 'post', 'put', 'use']);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Box routes are built with createBoxRouter(), which demands roles and runs inside withBoxScope. A bare Hono router skips both.',
    },
    messages: {
      bareHono:
        'new Hono() en una ruta: se saltea los roles y el box_id. Usá createBoxRouter(); si la ruta es pública de verdad, agregá el archivo a la lista de rutas públicas en eslint.config.js.',
      innerRouter:
        '.router.{{method}}() registra la ruta sin authorize(roles). Usá el método del createBoxRouter() con la lista de roles.',
    },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Hono') {
          context.report({ node, messageId: 'bareHono' });
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;
        if (!METHODS.has(callee.property.name)) return;
        const owner = callee.object;
        if (owner.type === 'MemberExpression' && owner.property.name === 'router') {
          context.report({
            node,
            messageId: 'innerRouter',
            data: { method: callee.property.name },
          });
        }
      },
    };
  },
};
