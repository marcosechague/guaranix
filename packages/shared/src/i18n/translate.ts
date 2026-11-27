type Messages = { readonly [key: string]: string | Messages };

/** Dot-separated paths to every string leaf of a messages object, e.g. `member.home.greeting`. */
export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

export type TranslationParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

function resolve(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const segment of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator<const T extends Messages>(messages: T) {
  return function translate(key: MessageKey<T>, params: TranslationParams = {}): string {
    const template = resolve(messages, key);
    // Returning the key keeps a missing translation visible without breaking the screen.
    if (template === undefined) return key;
    return interpolate(template, params);
  };
}
