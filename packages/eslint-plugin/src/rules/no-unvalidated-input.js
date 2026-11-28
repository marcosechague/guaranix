const RAW_INPUT = new Set([
  'arrayBuffer',
  'blob',
  'formData',
  'json',
  'param',
  'parseBody',
  'queries',
  'query',
  'text',
]);

/** `schema.safeParse(context.req.query())` validates on the spot, so it is fine. */
function isValidatedInPlace(call) {
  const parent = call.parent;
  return (
    parent?.type === 'CallExpression' &&
    parent.arguments[0] === call &&
    parent.callee.type === 'MemberExpression' &&
    ['parse', 'safeParse', 'parseAsync', 'safeParseAsync'].includes(parent.callee.property.name)
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Request input (body, query, params) is read through the Zod helpers (parseBody, parseQuery, idParam) so nothing unvalidated reaches a service.',
    },
    messages: {
      raw: 'Entrada sin validar: context.req.{{method}}(). Usá parseBody / parseQuery / idParam (lib/service-route.ts) con un esquema Zod de packages/shared.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;
        if (!RAW_INPUT.has(callee.property.name)) return;
        const owner = callee.object;
        const isReq =
          owner.type === 'MemberExpression' &&
          owner.property.type === 'Identifier' &&
          owner.property.name === 'req';
        if (!isReq || isValidatedInPlace(node)) return;
        context.report({ node, messageId: 'raw', data: { method: callee.property.name } });
      },
    };
  },
};
