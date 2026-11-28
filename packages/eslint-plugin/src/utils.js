/** Shared helpers for the GuaraniX ESLint rules. */

const LETTER = /\p{L}/u;
// Pictographs, except the ©, ® and ™ signs that legal copy may need.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\u{FE0F}/u;

export function hasLetter(text) {
  return LETTER.test(text);
}

export function findEmoji(text) {
  return EMOJI.exec(text)?.[0] ?? null;
}

/** `<Foo.Bar>` → "Foo.Bar", `<button>` → "button". */
export function elementName(openingElement) {
  const name = openingElement.name;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    const parts = [];
    let current = name;
    while (current.type === 'JSXMemberExpression') {
      parts.unshift(current.property.name);
      current = current.object;
    }
    parts.unshift(current.name);
    return parts.join('.');
  }
  return '';
}

export function isIntrinsic(openingElement) {
  return openingElement.name.type === 'JSXIdentifier' && /^[a-z]/.test(openingElement.name.name);
}

export function attributeName(attribute) {
  if (attribute.type !== 'JSXAttribute') return null;
  return attribute.name.type === 'JSXNamespacedName'
    ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
    : attribute.name.name;
}

export function findAttribute(openingElement, name) {
  return openingElement.attributes.find((attribute) => attributeName(attribute) === name);
}

/** Static string of a string literal or a template literal without expressions. */
export function staticString(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

/** Text of each string piece (literals and template chunks) inside `node`. */
export function stringPieces(node) {
  const pieces = [];
  const visit = (current) => {
    if (!current || typeof current !== 'object') return;
    if (current.type === 'Literal' && typeof current.value === 'string') {
      pieces.push({ node: current, text: current.value });
      return;
    }
    if (current.type === 'TemplateElement') {
      pieces.push({ node: current, text: current.value.cooked ?? '' });
      return;
    }
    for (const key of Object.keys(current)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = current[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === 'string') visit(value);
    }
  };
  visit(node);
  return pieces;
}
