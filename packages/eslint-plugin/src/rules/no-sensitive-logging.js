const SENSITIVE =
  /pass(word)?|secret|token|cookie|authorization|api_?key|private_?key|cedula|document_?number|ruc|cvv|cvc|card_?number|pan\b|otp|reset_?code|access_?code|verification_?code/i;
const LOGGERS = new Set(['console', 'logger', 'log']);
const LEVELS = new Set(['debug', 'error', 'info', 'log', 'trace', 'warn']);

/** Names (identifiers, properties, object keys) that the logged value is built from. */
function namesIn(node, names = []) {
  if (!node || typeof node !== 'object') return names;
  switch (node.type) {
    case 'Identifier':
      names.push({ node, name: node.name });
      return names;
    case 'MemberExpression':
      namesIn(node.object, names);
      if (!node.computed && node.property.type === 'Identifier') {
        names.push({ node: node.property, name: node.property.name });
      }
      return names;
    case 'Property':
      if (node.key.type === 'Identifier') names.push({ node: node.key, name: node.key.name });
      return namesIn(node.value, names);
    case 'Literal':
      return names;
    default:
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => namesIn(child, names));
        else if (value && typeof value.type === 'string') namesIn(value, names);
      }
      return names;
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Logs never include passwords, tokens, cookies, ID numbers (cédula) or card data.',
    },
    messages: {
      sensitive:
        'Posible dato sensible en un log ("{{name}}"). Logueá solo ids y códigos de error, nunca contraseñas, tokens, cédulas ni tarjetas.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;
        if (!LEVELS.has(callee.property.name)) return;
        if (callee.object.type !== 'Identifier' || !LOGGERS.has(callee.object.name)) return;
        for (const argument of node.arguments) {
          const hit = namesIn(argument).find(({ name }) => SENSITIVE.test(name));
          if (hit) {
            context.report({ node: hit.node, messageId: 'sensitive', data: { name: hit.name } });
            return;
          }
        }
      },
    };
  },
};
