import { attributeName, stringPieces } from '../utils.js';

const CLASS_HELPERS = new Set(['classNames', 'clsx', 'cn', 'cva', 'twMerge']);
// `w-[13px]`, `bg-[#fff]`, `[mask-type:luminance]`, `p-(--my-var)`.
const ARBITRARY = /(?:^|\s)((?:[\w-]+:)*!?(?:[\w-]*-)?(?:\[[^\]\s]+\]|\([^)\s]+\)))(?=\s|$)/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Apps use the Tailwind scale and the packages/ui tokens; one-off values like w-[13px] belong in packages/ui as a token or a component.',
    },
    messages: {
      arbitrary:
        'Valor arbitrario de Tailwind "{{value}}". Usá la escala o un token de packages/ui; si hace falta algo nuevo, agregalo ahí.',
    },
    schema: [],
  },
  create(context) {
    // A classNames() call inside className={…} is reached from both visitors.
    const seen = new WeakSet();
    const checkPieces = (node) => {
      for (const piece of stringPieces(node)) {
        if (seen.has(piece.node)) continue;
        seen.add(piece.node);
        const match = ARBITRARY.exec(piece.text);
        if (match) {
          context.report({ node: piece.node, messageId: 'arbitrary', data: { value: match[1] } });
        }
      }
    };
    return {
      JSXAttribute(node) {
        const name = attributeName(node);
        if ((name === 'className' || name === 'class') && node.value) checkPieces(node.value);
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && CLASS_HELPERS.has(node.callee.name)) {
          node.arguments.forEach(checkPieces);
        }
      },
    };
  },
};
