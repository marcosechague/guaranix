const RUNNERS = new Set(['execute', 'query', 'unsafe']);

function isPlainString(node) {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

/** A string built at runtime: untagged template with values, or concatenation. */
function isBuiltString(node) {
  if (!node) return false;
  if (node.type === 'TemplateLiteral') return node.expressions.length > 0;
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return [node.left, node.right].some((side) => side.type !== 'Literal' || isBuiltString(side));
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'SQL goes through Drizzle or the sql`` tag, which sends values as parameters. Strings glued together are SQL injection.',
    },
    messages: {
      raw: 'sql.raw() con un valor dinámico es inyección SQL. Usá sql`… ${valor}` (parámetros) o sql.identifier().',
      built:
        'SQL armado con texto ({{method}}). Usá el builder de Drizzle o el tag sql`…`, que manda los valores como parámetros.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;
        const method = callee.property.name;
        const [first] = node.arguments;
        if (
          method === 'raw' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'sql' &&
          !isPlainString(first)
        ) {
          context.report({ node, messageId: 'raw' });
          return;
        }
        if (RUNNERS.has(method) && isBuiltString(first)) {
          context.report({ node, messageId: 'built', data: { method } });
        }
      },
    };
  },
};
